# SQLite to MySQL Migration Guide

This document explains how to migrate your Deep-Research application from SQLite to MySQL.

## Prerequisites

1. MySQL server installed and running
2. Node.js and npm installed
3. Deep-Research project set up

## Configuration

1. Create a `.env.local` file in the project root (if it doesn't exist already)
2. Add the following MySQL configuration to your `.env.local` file:

```
# MySQL Database Configuration
DB_HOST="localhost"
DB_PORT=3306
DB_USER="root"
DB_PASSWORD="your_mysql_password"
DB_NAME="deep_research"
```

3. Replace `your_mysql_password` with your actual MySQL password
4. Make sure the database `deep_research` exists in your MySQL server (create it if it doesn't exist)

## Install Dependencies

Run the following command to install the required dependencies:

```
npm install
```

## Run the Migration

The migration script will transfer all data from your SQLite database to MySQL:

```
npm run migrate
```

This script:
1. Reads data from the existing SQLite database (`research.db`)
2. Creates the necessary tables in MySQL if they don't exist
3. Transfers all data to the MySQL database
4. Preserves all relationships and foreign keys

## Verify the Migration

After running the migration, you can verify that all data has been transferred correctly by:

1. Checking the console output for any errors
2. Connecting to your MySQL database and querying the tables
3. Starting the application with `npm start` and testing functionality

## Troubleshooting

If you encounter any issues during migration:

1. Check that your MySQL server is running and accessible
2. Verify that the database credentials in `.env.local` are correct
3. Ensure the `research.db` file exists in the project root
4. Check for any error messages in the console output

## Reverting to SQLite

If you need to revert to SQLite for any reason:

1. Edit the `.env.local` file and remove or comment out the MySQL configuration
2. The application will automatically use the SQLite database if MySQL configuration is not found

## Notes

- The SQLite database file (`research.db`) is not deleted during migration
- Both database implementations can coexist in the codebase
- The application will use MySQL if the configuration is present in the `.env.local` file
