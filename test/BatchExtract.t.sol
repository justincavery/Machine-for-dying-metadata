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

contract BatchExtractTest is Test {
    IMetadata internal constant DEPLOYED_METADATA = IMetadata(0x248B1149203933c1B08E985aD67138AF0dDd1b94);
    IClifford internal constant DEPLOYED_CLIFFORD = IClifford(0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C);
    ERC721 internal constant NFT_CONTRACT = ERC721(0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C);

    // Configure batch range here - extract in batches of 10
    uint256 constant START_TOKEN = 5975;
    uint256 constant END_TOKEN = 6000;  // Extract 10 tokens at a time

    function testBatchExtractURI() public {
        uint256 totalSupply = DEPLOYED_CLIFFORD.totalSupply();
        console.log("Total Supply:", totalSupply);

        uint256 endToken = END_TOKEN > totalSupply ? totalSupply : END_TOKEN;

        for (uint256 tokenId = START_TOKEN; tokenId < endToken; tokenId++) {
            try NFT_CONTRACT.tokenURI(tokenId) returns (string memory uri) {
                string memory path = string.concat("uri/", Strings.toString(tokenId), ".txt");
                vm.writeFile(path, uri);
                console.log("Extracted token:", tokenId);
            } catch {
                console.log("Skipped token (not minted?):", tokenId);
            }
        }
    }

    function testBatchExtractImages() public {
        uint256 totalSupply = DEPLOYED_CLIFFORD.totalSupply();
        uint256 endToken = END_TOKEN > totalSupply ? totalSupply : END_TOKEN;

        for (uint256 tokenId = START_TOKEN; tokenId < endToken; tokenId++) {
            try DEPLOYED_CLIFFORD.getSeed(tokenId) returns (uint256 seed) {
                int256 baseline = DEPLOYED_METADATA.getBaselineRarity(seed);
                string memory image = DEPLOYED_METADATA.composeOnlyImage(seed, baseline);
                string memory path = string.concat("images/", Strings.toString(tokenId), ".svg");
                vm.writeFile(path, image);
                console.log("Extracted image:", tokenId);
            } catch {
                console.log("Skipped image:", tokenId);
            }
        }
    }
}
