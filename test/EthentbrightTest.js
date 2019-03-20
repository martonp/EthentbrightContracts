const EthentFactory = artifacts.require("EthentFactory");
const Ethent = artifacts.require("Ethent");

const {
  getPrivateKeyAndAddress,
  lastBlockTime,
  ONE_DAY_SECONDS,
  ONE_HOUR_SECONDS,
  bumpEVMTime,
  signAddress,
  tryCatch
} = require("./testUtils")(web3);

contract("EthentFactory", function(accounts) {
  let factoryContract;
  let signInPrivateKey;
  let signInAddress;
  let evmTimeInOneDay;
  let maxAtendees; 
  let weiToDeposit; 

  beforeEach(async () => {
    factoryContract = await EthentFactory.new();
    ({ signInPrivateKey, signInAddress } = getPrivateKeyAndAddress());
	evmTimeInOneDay = (await lastBlockTime()) + ONE_DAY_SECONDS;
	maxAtendees = 10; 
	weiToDeposit = 1000000; 
  });

  it("Created event has correct attributes", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );

    const ethentAddress = await factoryContract.ethents(0);
    const ethentContract = await Ethent.at(ethentAddress);

    assert.equal(
      accounts[0].toLowerCase(),
      (await ethentContract.owner()).toLowerCase(),
      "Owner of ethent is not the caller or the creator contract."
    );
    assert.equal(
      maxAtendees,
      await ethentContract.maxAtendees(),
      "Max attendees is not what was sent to creator contract."
    );
    assert.equal(
      weiToDeposit,
      await ethentContract.weiToDeposit(),
      "Deposit amount is not what was sent to creator contract."
    );
    assert.equal(
      factoryContract.address,
      await ethentContract.creatorContract(),
      "Creator contract don't reference the right address."
    );
    assert.equal(
	  signInAddress.toLowerCase(),
      (await ethentContract.addressToVerify()).toLowerCase(),
      "Adress to verify sign in is not what was sent to contract."
	);
	
  });

  it("Able to register", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethentContract = await Ethent.at(ethentAddress);

    assert.equal(await ethentContract.registered(accounts[1]), false);
    await ethentContract.register({ from: accounts[1], value: weiToDeposit });
    assert.equal(await ethentContract.registered(accounts[1]), true);
  });

  it("Pause ethent creation works", async function() {

    await factoryContract.pauseEthentCreation(true);
    await tryCatch(
      factoryContract.createEthent(
        maxAtendees,
        weiToDeposit,
        signInAddress,
        evmTimeInOneDay
      )
    );

    await factoryContract.pauseEthentCreation(false);
    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay
    );

    const ethentAddress = await factoryContract.ethents(0);
    const ethentContract = await Ethent.at(ethentAddress);
    assert.equal(accounts[0], await ethentContract.owner());
  });

  it("Cancel ethent works properly", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethentContract = await Ethent.at(ethentAddress);

    for (let i = 1; i < 6; i++) {
      await ethentContract.register({ from: accounts[i], value: weiToDeposit });
    }

    const signature = signAddress(signInPrivateKey, accounts[5]);
    await ethentContract.signIn(signature.v, signature.r, signature.s, {
      from: accounts[5]
    });

    //Account other than owner cannot cancel ethent
    await tryCatch(
      factoryContract.cancelEthent(ethentAddress, { from: accounts[1] })
    );

    const balancesBeforeCancel = [];
    for (let i = 1; i < 6; i++) {
      let balance = await web3.eth.getBalance(accounts[i]);
      balancesBeforeCancel.push(balance);
    }

    await factoryContract.cancelEthent(ethentAddress, { from: accounts[0] });

    const balancesAfterCancel = [];
    for (let i = 1; i < 6; i++) {
      let balance = await web3.eth.getBalance(accounts[i]);
      balancesAfterCancel.push(balance);
    }

    for (let i = 0; i < balancesAfterCancel.length - 1; i++) {
      assert.isAbove(
        Number(balancesAfterCancel[i]),
        Number(balancesBeforeCancel[i]),
        "Balance has increased due to ethent being cancelled"
      );
    }

    assert.equal(
      balancesBeforeCancel[balancesBeforeCancel.legnth - 1],
      balancesAfterCancel[balancesBeforeCancel.legnth - 1],
      "Balance has not changed for someone who signed in"
    );
  });

  it("Tests that no more than maxAtendees can register", async function() {

	maxAtendees = 5; 

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[8] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

    for (let i = 0; i < maxAtendees; i++) {
      await ethent.register({ from: accounts[i], value: weiToDeposit });
    }

    await tryCatch(
      ethent.register({ from: accounts[maxAtendees], value: weiToDeposit })
    );
  });

  it("Tests that owner cannot register", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

    await tryCatch(ethent.register({ from: accounts[0], value: weiToDeposit }));
  });

  it("No one can register twice", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

    await ethent.register({ from: accounts[2], value: weiToDeposit });
    await tryCatch(ethent.register({ from: accounts[2], value: weiToDeposit }));
  });

  it("Right deposit amount has to be sent", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

    await tryCatch(
      ethent.register({ from: accounts[2], value: weiToDeposit / 2 })
    );
    await tryCatch(ethent.register({ from: accounts[2] }));
    await ethent.register({ from: accounts[2], value: weiToDeposit });
  });

  it("Only someone who registered can sign in", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

	const signature = signAddress(signInPrivateKey, accounts[2]);
	
    await tryCatch(
      ethent.signIn(signature.v, signature.r, signature.s, {
        from: accounts[2]
      })
    );
    await ethent.register({ from: accounts[2], value: weiToDeposit });
    await ethent.signIn(signature.v, signature.r, signature.s, {
      from: accounts[2]
    });
  });

  it("Someone who already signed in cannot do it again", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

	await ethent.register({ from: accounts[2], value: weiToDeposit });
	
	const signature = signAddress(signInPrivateKey, accounts[2]);
    await ethent.signIn(signature.v, signature.r, signature.s, {
      from: accounts[2]
    });
    await tryCatch(
      ethent.signIn(signature.v, signature.r, signature.s, {
        from: accounts[2]
      })
    );
  });

  it("Signing incorrect message does not work", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

    await ethent.register({ from: accounts[2], value: weiToDeposit });

    const signature = signAddress(signInPrivateKey, accounts[1]);
	await tryCatch(
      ethent.signIn(signature.v, signature.r, signature.s, {
        from: accounts[2]
      })
    );
  });

  it("endEvent cannot be called directly", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

    await tryCatch(ethent.endEthent());
  });

  it("Cannot remove ethent before one day after event", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);

    await tryCatch(
      factoryContract.endEthent(ethentAddress, { from: accounts[0] })
    );
  });

  it("Cannot vote if not registered", async function() {
	  
    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );

    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);
    await bumpEVMTime(ONE_DAY_SECONDS + ONE_HOUR_SECONDS + 1);
    return; 
    await tryCatch(ethent.voteForRefund({ from: accounts[1] }));
    await ethent.register({ from: accounts[1], value: weiToDeposit });
    await ethent.voteForRefund({ from: accounts[1] });

    const voted = await ethent.votedForRefund(accounts[1]);
    assert.isOk(voted, "Successfully voted");
  });

  it("Cannot vote before an hour after event", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

    await ethent.register({ from: accounts[1], value: weiToDeposit });
    await tryCatch(ethent.voteForRefund({ from: accounts[1] }));
    await bumpEVMTime(ONE_DAY_SECONDS + ONE_HOUR_SECONDS + 1);
    await ethent.voteForRefund({ from: accounts[1] });
    assert.isOk(await ethent.votedForRefund(accounts[1]), "Successfully voted");
  });

  it("Can only get refund if half of attendees voted", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);
    const ethent = await Ethent.at(ethentAddress);

    for (let i = 1; i < 7; i++) {
      await ethent.register({ from: accounts[i], value: weiToDeposit });
    }

    await bumpEVMTime(ONE_DAY_SECONDS + ONE_HOUR_SECONDS + 1);

    for (let i = 1; i < 3; i++) {
      await ethent.voteForRefund({ from: accounts[i] });
    }

    tryCatch(ethent.claimRefund({ from: accounts[1] }));

    await ethent.voteForRefund({ from: accounts[3] });

    await ethent.claimRefund({ from: accounts[1] });
  });

  it("Test remove ethent works when only one ethent exists", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);

    await bumpEVMTime(ONE_DAY_SECONDS + ONE_DAY_SECONDS + 1);

    await factoryContract.endEthent(ethentAddress);
    const ethentsList = await factoryContract.getAllEthents();

    assert.lengthOf(ethentsList, 0);
  });

  it("Removal of ethent from ethent factory works properly", async function() {

    for (let i = 0; i < 5; i++) {
      await factoryContract.createEthent(
        maxAtendees,
        weiToDeposit,
        signInAddress,
        evmTimeInOneDay,
        { from: accounts[0] }
      );
    }

    const ethentsList = await factoryContract.getAllEthents();
    assert.lengthOf(ethentsList, 5);

    const ethentToRemove = ethentsList[2];
    await bumpEVMTime(ONE_DAY_SECONDS + ONE_DAY_SECONDS + 1);
    await factoryContract.endEthent(ethentToRemove);

    const ethentsListAfterRemoval = await factoryContract.getAllEthents();
    assert.lengthOf(ethentsListAfterRemoval, 4);

    for (let i = 0; i < 4; i++) {
      let remainingEthent = ethentsListAfterRemoval[i];
      let indexInContract = await factoryContract.ethentLookup(remainingEthent);
      assert.equal(indexInContract, i);
      assert.notEqual(remainingEthent, ethentToRemove);
    }
  });

  it("Only the creator of an ethent can end it", async function() {

    await factoryContract.createEthent(
      maxAtendees,
      weiToDeposit,
      signInAddress,
      evmTimeInOneDay,
      { from: accounts[0] }
    );
    const ethentAddress = await factoryContract.ethents(0);

    await tryCatch(
      factoryContract.endEthent(ethentAddress, { from: accounts[1] })
	);
	
    factoryContract.endEthent(ethentAddress, { from: accounts[0] });
  });
});
