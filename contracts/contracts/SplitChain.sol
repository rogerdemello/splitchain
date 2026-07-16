// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SplitChain
 * @notice On-chain group expense splitter for friends. Groups track shared
 *         expenses; the contract maintains each member's *net balance* and lets
 *         debtors settle up by sending real MON to a creditor.
 *
 * Design:
 *  - The chain is the source of truth for the ledger and for settlement value.
 *  - Debt *simplification* ("who should pay whom to clear everyone with the
 *    fewest transfers") is computed OFF-chain by the frontend from the net
 *    balances returned by {getBalances}. Each suggested transfer is one real
 *    {settle} transaction that moves MON.
 *  - Split math is done off-chain and passed in as explicit `shares`; the
 *    contract enforces `sum(shares) == amount` so no rounding drift is possible.
 *
 * Invariant: for every group, the sum of all members' net balances is always 0.
 */
contract SplitChain {
    /* --------------------------------- Types -------------------------------- */

    struct Group {
        string name;
        address[] members;
        uint64 expenseCount;
        bool exists;
    }

    struct Expense {
        address payer; // who fronted the money
        uint128 amount; // total paid (wei / MON, 18 decimals)
        address[] participants; // who shares this expense
        uint128[] shares; // amount each participant owes; sum == amount
        string description;
        uint64 timestamp;
        uint64 amountUsdCents; // display-only USD value at log time (0 = unknown)
    }

    /* -------------------------------- Storage ------------------------------- */

    uint256 public groupCount;
    mapping(uint256 => Group) private groups;
    mapping(uint256 => Expense[]) private expenses;

    /// @notice Membership lookup: groupId => member => isMember.
    mapping(uint256 => mapping(address => bool)) public isMember;

    /// @notice Net balance: > 0 the group owes them (creditor), < 0 they owe (debtor).
    mapping(uint256 => mapping(address => int256)) public netBalance;

    /* --------------------------------- Events ------------------------------- */

    event GroupCreated(uint256 indexed groupId, string name, address indexed creator);
    event MemberJoined(uint256 indexed groupId, address indexed member);
    event ExpenseAdded(
        uint256 indexed groupId,
        uint256 indexed expenseIndex,
        address indexed payer,
        uint128 amount,
        uint64 amountUsdCents,
        string description
    );
    event DebtSettled(uint256 indexed groupId, address indexed from, address indexed to, uint256 amount);

    /* --------------------------- Reentrancy guard --------------------------- */

    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    /* -------------------------------- Modifiers ----------------------------- */

    modifier groupExists(uint256 groupId) {
        require(groups[groupId].exists, "no group");
        _;
    }

    modifier onlyMember(uint256 groupId) {
        require(isMember[groupId][msg.sender], "not a member");
        _;
    }

    /* ------------------------------- Mutations ------------------------------ */

    /**
     * @notice Create a group. The caller is always included as a member.
     * @param name Human-readable group name (e.g. "Goa Trip").
     * @param members Additional member addresses (duplicates / caller are ignored).
     * @return groupId The id of the newly created group.
     */
    function createGroup(string calldata name, address[] calldata members)
        external
        returns (uint256 groupId)
    {
        groupId = groupCount++;
        Group storage g = groups[groupId];
        g.name = name;
        g.exists = true;

        _addMember(groupId, msg.sender);
        for (uint256 i = 0; i < members.length; i++) {
            _addMember(groupId, members[i]);
        }

        emit GroupCreated(groupId, name, msg.sender);
    }

    /**
     * @notice Join an existing group yourself (used by shareable invite links).
     * @dev Idempotent — no-op if already a member. Anyone with the group id may
     *      join, which is the intended behavior for a friends-share invite link.
     */
    function joinGroup(uint256 groupId) external groupExists(groupId) {
        if (isMember[groupId][msg.sender]) return;
        _addMember(groupId, msg.sender);
        emit MemberJoined(groupId, msg.sender);
    }

    /**
     * @notice Log an expense the caller paid, split across `participants`.
     * @dev Splits are computed off-chain and passed as `shares`; the contract
     *      requires `sum(shares) == amount` so the net-balance invariant holds
     *      exactly (no on-chain rounding). Every participant must be a member.
     * @param usdCents Display-only USD value at log time (0 if unknown). The
     *      ledger and settlement remain denominated in MON.
     */
    function addExpense(
        uint256 groupId,
        uint128 amount,
        address[] calldata participants,
        uint128[] calldata shares,
        string calldata description,
        uint64 usdCents
    ) external groupExists(groupId) onlyMember(groupId) {
        require(amount > 0, "amount=0");
        require(participants.length > 0, "no participants");
        require(participants.length == shares.length, "len mismatch");

        uint256 sum;
        for (uint256 i = 0; i < shares.length; i++) {
            require(isMember[groupId][participants[i]], "participant !member");
            sum += shares[i];
            netBalance[groupId][participants[i]] -= int256(uint256(shares[i]));
        }
        require(sum == amount, "shares != amount");

        netBalance[groupId][msg.sender] += int256(uint256(amount));

        uint256 expenseIndex = expenses[groupId].length;
        expenses[groupId].push(
            Expense({
                payer: msg.sender,
                amount: amount,
                participants: participants,
                shares: shares,
                description: description,
                timestamp: uint64(block.timestamp),
                amountUsdCents: usdCents
            })
        );
        groups[groupId].expenseCount++;

        emit ExpenseAdded(groupId, expenseIndex, msg.sender, amount, usdCents, description);
    }

    /**
     * @notice Settle up: the caller (a debtor) pays `to` (a creditor) real MON.
     * @dev The core on-chain feature. `msg.value` MON is forwarded to `to`, and
     *      both net balances move toward zero. Checks-Effects-Interactions +
     *      a reentrancy guard protect the external transfer.
     */
    function settle(uint256 groupId, address to)
        external
        payable
        groupExists(groupId)
        onlyMember(groupId)
        nonReentrant
    {
        require(msg.value > 0, "value=0");
        require(to != msg.sender, "self");
        require(isMember[groupId][to], "payee !member");

        // Effects first.
        int256 value = int256(msg.value);
        netBalance[groupId][msg.sender] += value; // debtor moves up toward 0
        netBalance[groupId][to] -= value; // creditor moves down toward 0

        emit DebtSettled(groupId, msg.sender, to, msg.value);

        // Interaction last.
        (bool ok, ) = payable(to).call{value: msg.value}("");
        require(ok, "transfer failed");
    }

    /**
     * @notice Settle up with MULTIPLE creditors in a single transaction.
     * @dev The headline batch upgrade: a debtor clears every debt at once. The
     *      sum of `amounts` must equal `msg.value`. Uses the same
     *      Checks-Effects-Interactions ordering as {settle} — all net balances
     *      are updated first, then each transfer is made — under one reentrancy
     *      guard. Reverts (reverting the whole batch) if any transfer fails.
     * @param tos Creditors to pay.
     * @param amounts MON amount to send each creditor (index-aligned with `tos`).
     */
    function settleMany(uint256 groupId, address[] calldata tos, uint256[] calldata amounts)
        external
        payable
        groupExists(groupId)
        onlyMember(groupId)
        nonReentrant
    {
        require(tos.length > 0, "no payees");
        require(tos.length == amounts.length, "len mismatch");

        // Effects: update every balance first.
        uint256 total;
        for (uint256 i = 0; i < tos.length; i++) {
            address to = tos[i];
            uint256 amt = amounts[i];
            require(amt > 0, "value=0");
            require(to != msg.sender, "self");
            require(isMember[groupId][to], "payee !member");

            total += amt;
            int256 value = int256(amt);
            netBalance[groupId][msg.sender] += value;
            netBalance[groupId][to] -= value;

            emit DebtSettled(groupId, msg.sender, to, amt);
        }
        require(total == msg.value, "value != sum");

        // Interactions: pay each creditor.
        for (uint256 i = 0; i < tos.length; i++) {
            (bool ok, ) = payable(tos[i]).call{value: amounts[i]}("");
            require(ok, "transfer failed");
        }
    }

    /* --------------------------------- Views -------------------------------- */

    function getBalances(uint256 groupId)
        external
        view
        groupExists(groupId)
        returns (address[] memory members, int256[] memory balances)
    {
        members = groups[groupId].members;
        balances = new int256[](members.length);
        for (uint256 i = 0; i < members.length; i++) {
            balances[i] = netBalance[groupId][members[i]];
        }
    }

    function getExpenses(uint256 groupId)
        external
        view
        groupExists(groupId)
        returns (Expense[] memory)
    {
        return expenses[groupId];
    }

    function getGroup(uint256 groupId)
        external
        view
        groupExists(groupId)
        returns (string memory name, address[] memory members, uint64 expenseCount)
    {
        Group storage g = groups[groupId];
        return (g.name, g.members, g.expenseCount);
    }

    function getMembers(uint256 groupId)
        external
        view
        groupExists(groupId)
        returns (address[] memory)
    {
        return groups[groupId].members;
    }

    /* -------------------------------- Internal ------------------------------ */

    function _addMember(uint256 groupId, address member) private {
        if (member == address(0) || isMember[groupId][member]) return;
        isMember[groupId][member] = true;
        groups[groupId].members.push(member);
    }
}
