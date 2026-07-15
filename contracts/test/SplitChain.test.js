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
        "Hotel"
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
        "Snacks"
      );
    expect(await split.netBalance(groupId, alice.address)).to.equal(6n); // +10 -4
    expect(await split.netBalance(groupId, bob.address)).to.equal(-3n);
    expect(await split.netBalance(groupId, carol.address)).to.equal(-3n);
  });

  it("reverts when shares do not sum to amount", async function () {
    const groupId = await makeGroup();
    await expect(
      split
        .connect(alice)
        .addExpense(groupId, 10n, [alice.address, bob.address], [4n, 3n], "bad")
    ).to.be.revertedWith("shares != amount");
  });

  it("reverts addExpense from a non-member", async function () {
    const groupId = await makeGroup();
    await expect(
      split
        .connect(dave)
        .addExpense(groupId, 1n, [dave.address], [1n], "x")
    ).to.be.revertedWith("not a member");
  });

  it("reverts when a participant is not a member", async function () {
    const groupId = await makeGroup();
    await expect(
      split
        .connect(alice)
        .addExpense(groupId, 1n, [dave.address], [1n], "x")
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
        "Hotel"
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

  it("reverts views and actions on a non-existent group", async function () {
    await expect(split.getBalances(99)).to.be.revertedWith("no group");
  });
});
