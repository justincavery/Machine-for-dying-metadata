// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

interface IMetadata {
    function getBaselineRarity(uint256 seed) external view returns (int256);
    function composeOnlyImage(uint256 seed, int256 baseline) external view returns (string memory);
}

interface IClifford {
    function getSeed(uint256 tokenId) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract SingleExtractTest is Test {
    IMetadata internal constant DEPLOYED_METADATA = IMetadata(0x248B1149203933c1B08E985aD67138AF0dDd1b94);
    IClifford internal constant DEPLOYED_CLIFFORD = IClifford(0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C);
    ERC721 internal constant NFT_CONTRACT = ERC721(0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C);

    // Set via environment variable: TOKEN_ID
    uint256 constant TOKEN_ID = 0;

    function testExtractSingleURI() public {
        uint256 tokenId = vm.envOr("TOKEN_ID", TOKEN_ID);

        string memory uri = NFT_CONTRACT.tokenURI(tokenId);
        string memory path = string.concat("uri/", Strings.toString(tokenId), ".txt");
        vm.writeFile(path, uri);
        console.log("SUCCESS:", tokenId);
    }

    function testExtractSingleImage() public {
        uint256 tokenId = vm.envOr("TOKEN_ID", TOKEN_ID);

        uint256 seed = DEPLOYED_CLIFFORD.getSeed(tokenId);
        int256 baseline = DEPLOYED_METADATA.getBaselineRarity(seed);
        string memory image = DEPLOYED_METADATA.composeOnlyImage(seed, baseline);
        string memory path = string.concat("images/", Strings.toString(tokenId), ".svg");
        vm.writeFile(path, image);
        console.log("SUCCESS:", tokenId);
    }
}
