-- NFT Metadata Database Schema
-- Run with: wrangler d1 execute nft-metadata-db --file=scripts/setup-db.sql

-- Drop existing tables if they exist
DROP TABLE IF EXISTS attributes;
DROP TABLE IF EXISTS nfts;
DROP TABLE IF EXISTS collection_metadata;

-- Create NFTs table
CREATE TABLE nfts (
  token_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_cid TEXT,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create attributes table for searchable traits
CREATE TABLE attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  trait_type TEXT NOT NULL,
  value TEXT NOT NULL,
  FOREIGN KEY (token_id) REFERENCES nfts(token_id)
);

-- Create indexes for fast searching
CREATE INDEX idx_attributes_trait_type ON attributes(trait_type);
CREATE INDEX idx_attributes_value ON attributes(value);
CREATE INDEX idx_attributes_token_id ON attributes(token_id);
CREATE INDEX idx_nfts_name ON nfts(name);

-- Create metadata table for collection info
CREATE TABLE collection_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial metadata
INSERT INTO collection_metadata (key, value) VALUES ('total_supply', '0');
INSERT INTO collection_metadata (key, value) VALUES ('indexed_count', '0');
INSERT INTO collection_metadata (key, value) VALUES ('last_indexed_token', '-1');
