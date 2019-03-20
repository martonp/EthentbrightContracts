pragma solidity ^0.4.25;

contract Ethent {

    event UserRegistered (
        address user
    ); 

    event UserSignedIn (
        address user
    ); 
    
    event UserVoted (
        address user
    ); 

    address public owner; 
    address public creatorContract; 

    uint64 public maxAtendees; 
    uint64 public numAtendees; 
    uint64 public numVotedForRefund; 
    uint64 public weiToDeposit; 

    uint256 public eventTime; 

    address public addressToVerify; 

    address[] public atendees; 
    mapping(address => bool) public registered; 
    mapping(address => bool) public signedIn;
    mapping(address => bool) public votedForRefund; 
    mapping(address => bool) public claimedRefund;  

    modifier onlyCreatorContract {
        require(msg.sender == creatorContract, "This function can only be called through the creator contract.");
        _;
    }

    constructor(uint64 _maxAtendees, uint64 _weiToDeposit, address _owner, 
                address _creator, address _addressToVerify, uint _eventTime) public {
        maxAtendees = _maxAtendees; 
        numAtendees = 0;
        weiToDeposit = _weiToDeposit; 
        creatorContract = _creator; 
        addressToVerify = _addressToVerify; 
        eventTime = _eventTime; 
        owner = _owner; 
    }

    function register() public payable {
        require(msg.value == weiToDeposit, "User did not deposit the correct amount.");  
        require(!registered[msg.sender], "User is already registered for this ethent.");  
        require(numAtendees < maxAtendees, "Ethent is full.");
        //Need to block owner from registering to avoid reentrancy attack in cancelEthent
        require(msg.sender != owner, "Owner cannot register for ethent");

        atendees.push(msg.sender); 
        registered[msg.sender] = true; 
        numAtendees++;
        
        emit UserRegistered(msg.sender);  
    }

    function verifySignIn(uint8 _v, bytes32 _r, bytes32 _s, address _toSign) public view returns(bool) {
        address signer = ecrecover(bytes20(_toSign), _v, _r, _s);
        return addressToVerify == signer;
    }

    function signIn(uint8 _v, bytes32 _r, bytes32 _s) public {
        require(registered[msg.sender], "User has not yet registered");  
        require(!signedIn[msg.sender], "User has already signed in.");  
        require(verifySignIn(_v, _r, _s, msg.sender), "Signature is invalid");

        signedIn[msg.sender] = true; 
        msg.sender.transfer(weiToDeposit); 
        
        emit UserSignedIn(msg.sender);  
    }

    function endEthent() public onlyCreatorContract {
        require(now > (eventTime + 1 days), "One day has not past since start of ethent.");
        selfdestruct(owner);
    }

    function cancelEthent() public onlyCreatorContract {
        for(uint i = 0; i < atendees.length; i++){
            if(!signedIn[atendees[i]]){
                atendees[i].transfer(weiToDeposit); 
            }
        }

        selfdestruct(owner);
    }

    function voteForRefund() public {
        require(block.timestamp > (eventTime + 1 hours), "One hour has not past since start of ethent."); 
        require(!votedForRefund[msg.sender], "User has already voted for ethent."); 
        require(registered[msg.sender], "User has not registered"); 

        votedForRefund[msg.sender] = true;         
        numVotedForRefund++; 
    }

    function claimRefund() public {
        require(((numAtendees*10) / numVotedForRefund ) <= 20, 
            "At least half of the attendees need to vote for refund.");
        require(!claimedRefund[msg.sender], "User has already claimed refund.");
        require(registered[msg.sender], "User is not registered.");

        claimedRefund[msg.sender] = true; 
        msg.sender.transfer(weiToDeposit); 
    }

}

contract EthentFactory {

    event EthentCreated (
        address ethentAddress
    );

    event EthentRemoved (
        address ethentAddress
    ); 

    bool public paused; 
    address public owner; 

    address[] public ethents; 
    mapping(address => uint) public ethentLookup; 

    constructor() public {
        paused = false; 
        owner = msg.sender; 
    }

    modifier isEthentOwner(address _owner, address ethentAddress) {
        address contractOwner = Ethent(ethentAddress).owner(); 
        require(contractOwner == _owner, "Only the owner of the ethent can call this."); 
        _; 
    }

    function createEthent(uint64 _maxAtendees, uint64 _weiToDeposit, 
                            address _toVerify, uint eventTime) public returns (address) {
        require(!paused, "Ethent creation is paused."); 

        Ethent ethent = new Ethent(_maxAtendees, _weiToDeposit, msg.sender, address(this), _toVerify, eventTime);
        address newEthentAddress = address(ethent); 

        ethents.push(newEthentAddress); 
        ethentLookup[newEthentAddress] = ethents.length - 1; 

        emit EthentCreated(newEthentAddress); 

        return newEthentAddress; 
    }

    function pauseEthentCreation(bool _paused) public {
        require(msg.sender == owner, "Only owner can pause ethent creation.");
        paused = _paused; 
    }
    
    function removeEthent(address toRemove, bool cancelling) private {
        Ethent ethentToRemove = Ethent(toRemove);
        uint index = ethentLookup[toRemove]; 

        ethentLookup[toRemove] = 0; 
        ethents[index] = ethents[ethents.length-1]; 
        ethentLookup[ethents[index]] = index; 
        ethents.length = ethents.length - 1;

        if(cancelling){
            ethentToRemove.cancelEthent();
        }else{
            ethentToRemove.endEthent(); 
        } 

        emit EthentRemoved(address(ethentToRemove)); 
    }

    function endEthent(address toRemove) public isEthentOwner(msg.sender, toRemove) {
        removeEthent(toRemove, false); 
    }

    function cancelEthent(address toRemove) public isEthentOwner(msg.sender, toRemove) {
        removeEthent(toRemove, true); 
    }

    function getAllEthents() public view returns (address[] memory) {
        return ethents; 
    } 

}