const ethUtils = require("ethereumjs-util");
const keythereum = require("keythereum");

module.exports = function(web3) {
  return {

    getPrivateKeyAndAddress: () => {
      var privateKey = keythereum.create().privateKey;
      var addressBuffer = ethUtils.privateToAddress(privateKey);
      var address = ethUtils.bufferToHex(addressBuffer);
      return {
        signInPrivateKey: privateKey,
        signInAddress: address
      };
	},
	
    lastBlockTime: async () => {
      var currentBlock = web3.eth.blockNumber;
      var blockInfo = await web3.eth.getBlock(currentBlock);
      return blockInfo.timestamp;
	},
	
    ONE_DAY_SECONDS: 60 * 60 * 24,
	ONE_HOUR_SECONDS: 60 * 60,
	
    bumpEVMTime: async seconds => {
      const jsonrpc = "2.0";
      const id = 0;
      const send = (method, params = []) =>
        web3.currentProvider.send({
          id,
          jsonrpc,
          method,
          params
        });
      await send("evm_increaseTime", [seconds]);
      await send("evm_mine");
	},
	
    signAddress(pk, address) {
      const dataString = address.substring(2) + "00".repeat(12);
      const data = Buffer.from(dataString, "hex");
      const signature = ethUtils.ecsign(data, pk);
      return {
        v: signature.v,
        r: "0x" + signature.r.toString("hex"),
        s: "0x" + signature.s.toString("hex")
      };
	},
	
    tryCatch: async promise => {
      try {
        await promise;
        throw null;
      } catch (error) {
        assert(error, "Expected an error but did not get one");
      }
    }
  };
};
