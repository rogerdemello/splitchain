const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SplitChain", function () {
  let split, alice, bob, carol, dave;

  beforeEach(async function () {
    [alice, bob, carol, dave] = await ethers.getSigners();
    const SplitChain = await ethers.getContractFactory("SplitChain");
    split = await SplitChain.deploy();
    await split.waitForDeployment();
  });

  async function makeGroup() {
    // alice creates a group with bob and carol
    const tx = await split
      .connect(alice)
      .createGroup("Goa Trip", [bob.address, carol.address]);
    await tx.wait();
    return 0n; // first group id
  }

  it("creates a group with the creator auto-included and dedupes members", async function () {
    // pass alice (creator) and a duplicate bob on purpose
    await split
      .connect(alice)
      .createGroup("Trip", [alice.address, bob.address, bob.address]);
    const members = await split.getMembers(0);
    expect(members).to.deep.equal([alice.address, bob.address]);
    expect(await split.groupCount()).to.equal(1n);
  });

  it("emits GroupCreated", async function () {
    await expect(split.connect(alice).createGroup("X", [bob.address]))
      .to.emit(split, "GroupCreated")
      .withArgs(0, "X", alice.address);
  });

  it("splits an expense and keeps balances netting to zero", async function () {
    const groupId = await makeGroup();
    // alice pays 3 MON split equally 1/1/1 among alice, bob, carol
    const amount = ethers.parseEther("3");
    const share = ethers.parseEther("1");
    await split
      .connect(alice)
      .addExpense(
        groupId,
        amount,
        [alice.address, bob.address, carol.address],
        [share, share, share],
        "Hotel",
        0
      );

    const [members, balances] = await split.getBalances(groupId);
    const map = Object.fromEntries(members.map((m, i) => [m, balances[i]]));
    // alice paid 3, owes 1 => net +2 ; bob and carol each net -1
    expect(map[alice.address]).to.equal(ethers.parseEther("2"));
    expect(map[bob.address]).to.equal(ethers.parseEther("-1"));
    expect(map[carol.address]).to.equal(ethers.parseEther("-1"));
    const sum = balances.reduce((a, b) => a + b, 0n);
    expect(sum).to.equal(0n);
  });

  it("supports uneven custom splits (remainder handled off-chain)", async function () {
    const groupId = await makeGroup();
    // 10 wei split 3 ways: 4/3/3, payer (alice) absorbs remainder
    await split
      .connect(alice)
      .addExpense(
        groupId,
        10n,
        [alice.address, bob.address, carol.address],
        [4n, 3n, 3n],
        "Snacks",
        0
      );
    expect(await split.netBalance(groupId, alice.address)).to.equal(6n); // +10 -4
    expect(await split.netBalance(groupId, bob.address)).to.equal(-3n);
    expect(await split.netBalance(groupId, carol.address)).to.equal(-3n);
  });

  it("stores usdCents metadata and emits it in ExpenseAdded", async function () {
    const groupId = await makeGroup();
    const amount = ethers.parseEther("3");
    const share = ethers.parseEther("1");
    await expect(
      split
        .connect(alice)
        .addExpense(
          groupId,
          amount,
          [alice.address, bob.address, carol.address],
          [share, share, share],
          "Dinner",
          4599 // $45.99
        )
    )
      .to.emit(split, "ExpenseAdded")
      .withArgs(groupId, 0, alice.address, amount, 4599, "Dinner");

    const list = await split.getExpenses(groupId);
    expect(list[0].amountUsdCents).to.equal(4599n);
  });

  it("reverts when shares do not sum to amount", async function () {
    const groupId = await makeGroup();
    await expect(
      split
        .connect(alice)
        .addExpense(groupId, 10n, [alice.address, bob.address], [4n, 3n], "bad", 0)
    ).to.be.revertedWith("shares != amount");
  });

  it("reverts addExpense from a non-member", async function () {
    const groupId = await makeGroup();
    await expect(
      split
        .connect(dave)
        .addExpense(groupId, 1n, [dave.address], [1n], "x", 0)
    ).to.be.revertedWith("not a member");
  });

  it("reverts when a participant is not a member", async function () {
    const groupId = await makeGroup();
    await expect(
      split
        .connect(alice)
        .addExpense(groupId, 1n, [dave.address], [1n], "x", 0)
    ).to.be.revertedWith("participant !member");
  });

  it("settle moves real MON and zeroes out the debt", async function () {
    const groupId = await makeGroup();
    const amount = ethers.parseEther("3");
    const share = ethers.parseEther("1");
    await split
      .connect(alice)
      .addExpense(
        groupId,
        amount,
        [alice.address, bob.address, carol.address],
        [share, share, share],
        "Hotel",
        0
      );

    // bob owes 1 MON; bob settles to alice
    const pay = ethers.parseEther("1");
    const aliceBefore = await ethers.provider.getBalance(alice.address);

    await expect(split.connect(bob).settle(groupId, alice.address, { value: pay }))
      .to.emit(split, "DebtSettled")
      .withArgs(groupId, bob.address, alice.address, pay);

    const aliceAfter = await ethers.provider.getBalance(alice.address);
    expect(aliceAfter - aliceBefore).to.equal(pay); // alice actually received MON

    expect(await split.netBalance(groupId, bob.address)).to.equal(0n);
    expect(await split.netBalance(groupId, alice.address)).to.equal(
      ethers.parseEther("1")
    ); // was +2, received 1 => +1
  });

  it("reverts settle with zero value, to self, or to a non-member", async function () {
    const groupId = await makeGroup();
    await expect(
      split.connect(bob).settle(groupId, alice.address, { value: 0 })
    ).to.be.revertedWith("value=0");
    await expect(
      split.connect(bob).settle(groupId, bob.address, { value: 1n })
    ).to.be.revertedWith("self");
    await expect(
      split.connect(bob).settle(groupId, dave.address, { value: 1n })
    ).to.be.revertedWith("payee !member");
  });

  it("settleMany clears multiple debts in one tx and pays each creditor", async function () {
    // Group of 3: alice, bob, carol. bob owes both alice and carol.
    const groupId = await makeGroup();
    // alice pays 2 (bob owes alice 1); carol pays 2 (bob owes carol 1)
    const two = ethers.parseEther("2");
    const one = ethers.parseEther("1");
    await split
      .connect(alice)
      .addExpense(groupId, two, [alice.address, bob.address], [one, one], "A", 0);
    await split
      .connect(carol)
      .addExpense(groupId, two, [carol.address, bob.address], [one, one], "C", 0);

    // bob now owes alice 1 and carol 1
    expect(await split.netBalance(groupId, bob.address)).to.equal(
      ethers.parseEther("-2")
    );

    const aliceBefore = await ethers.provider.getBalance(alice.address);
    const carolBefore = await ethers.provider.getBalance(carol.address);

    // bob settles BOTH in a single transaction
    await split
      .connect(bob)
      .settleMany(groupId, [alice.address, carol.address], [one, one], {
        value: ethers.parseEther("2"),
      });

    expect((await ethers.provider.getBalance(alice.address)) - aliceBefore).to.equal(one);
    expect((await ethers.provider.getBalance(carol.address)) - carolBefore).to.equal(one);
    expect(await split.netBalance(groupId, bob.address)).to.equal(0n);
    expect(await split.netBalance(groupId, alice.address)).to.equal(0n);
    expect(await split.netBalance(groupId, carol.address)).to.equal(0n);
  });

  it("settleMany reverts when total != msg.value, and on self / non-member payee", async function () {
    const groupId = await makeGroup();
    const one = ethers.parseEther("1");
    await expect(
      split
        .connect(bob)
        .settleMany(groupId, [alice.address, carol.address], [one, one], {
          value: ethers.parseEther("1.5"),
        })
    ).to.be.revertedWith("value != sum");

    await expect(
      split.connect(bob).settleMany(groupId, [bob.address], [one], { value: one })
    ).to.be.revertedWith("self");

    await expect(
      split.connect(bob).settleMany(groupId, [dave.address], [one], { value: one })
    ).to.be.revertedWith("payee !member");
  });

  it("joinGroup lets a new address self-join, emits MemberJoined, and is idempotent", async function () {
    const groupId = await makeGroup();
    expect(await split.isMember(groupId, dave.address)).to.equal(false);

    await expect(split.connect(dave).joinGroup(groupId))
      .to.emit(split, "MemberJoined")
      .withArgs(groupId, dave.address);

    expect(await split.isMember(groupId, dave.address)).to.equal(true);
    const members = await split.getMembers(groupId);
    expect(members).to.include(dave.address);

    // idempotent: joining again does not duplicate or revert
    await split.connect(dave).joinGroup(groupId);
    const after = await split.getMembers(groupId);
    expect(after.filter((m) => m === dave.address).length).to.equal(1);
  });

  it("reverts views and actions on a non-existent group", async function () {
    await expect(split.getBalances(99)).to.be.revertedWith("no group");
    await expect(split.connect(dave).joinGroup(99)).to.be.revertedWith("no group");
  });
});
