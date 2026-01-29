// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract FindTokensTest is Test {
    ERC721 internal constant NFT = ERC721(0x3965dEE5ef611d4dd74FC6B6c54c37F643208A5C);

    function testFindValidTokens() public view {
        console.log("Searching for valid tokens...");

        // Try various token ID ranges
        uint256[] memory testIds = new uint256[](20);
        testIds[0] = 0;
        testIds[1] = 1;
        testIds[2] = 100;
        testIds[3] = 500;
        testIds[4] = 1000;
        testIds[5] = 2000;
        testIds[6] = 3000;
        testIds[7] = 4000;
        testIds[8] = 5000;
        testIds[9] = 5999;
        testIds[10] = 10;
        testIds[11] = 50;
        testIds[12] = 99;
        testIds[13] = 101;
        testIds[14] = 999;
        testIds[15] = 1001;
        testIds[16] = 2500;
        testIds[17] = 3500;
        testIds[18] = 4500;
        testIds[19] = 5500;

        for (uint256 i = 0; i < testIds.length; i++) {
            uint256 tokenId = testIds[i];
            try NFT.ownerOf(tokenId) returns (address owner) {
                console.log("Token", tokenId, "exists, owner:", owner);
            } catch {
                console.log("Token", tokenId, "does NOT exist");
            }
        }
    }
}
