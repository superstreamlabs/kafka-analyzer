#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { runCLI } = require('../src/cli');

// Load environment variables
require('dotenv').config();

// CLI version and description
program
  .name('superstream-analyzer')
  .description('Interactive utility to analyze Kafka clusters health and configuration')
  .version('1.0.0')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--nats-config <path>', 'Path to NATS configuration file (uploads to NATS instead of generating files)')
  .option('-b, --bootstrap-servers <servers>', 'Comma-separated list of Kafka bootstrap servers')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-t, --timeout <seconds>', 'Connection timeout in seconds', '30')

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error.message);
  if (program.opts().verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

// Parse arguments and run CLI
program.parse();

const options = program.opts();

// Run the main CLI application
runCLI(options).catch((error) => {
  console.error('\n❌ Application Error:', error.message);
  if (options.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
}); 