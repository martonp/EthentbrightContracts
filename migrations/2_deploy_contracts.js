const EthentFactory = artifacts.require("EthentFactory");

module.exports = function(deployer) {
    deployer.deploy(EthentFactory);
}

