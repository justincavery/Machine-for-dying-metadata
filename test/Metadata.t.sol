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
}

contract CounterTest is Test {
    IMetadata internal constant DEPLOYED_METADATA = IMetadata(0x248B1149203933c1B08E985aD67138AF0dDd1b94);
    IClifford internal constant DEPLOYED_CLIFFORD = IClifford(0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C);

    uint tokenId = 1;

    function testGetTokenURI() public {
        string memory path = string.concat("uri/", Strings.toString(tokenId), ".txt");
        string memory uri = ERC721(0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C).tokenURI(tokenId);
        vm.writeFile(path, uri);
    }

    function testWriteImage() public {
        string memory path = string.concat("images/", Strings.toString(tokenId), ".svg");
        int baseline = DEPLOYED_METADATA.getBaselineRarity(DEPLOYED_CLIFFORD.getSeed(tokenId));
        vm.writeFile(path, DEPLOYED_METADATA.composeOnlyImage(DEPLOYED_CLIFFORD.getSeed(tokenId), baseline));
    }
}