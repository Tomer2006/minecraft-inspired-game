import { pool } from './database.js';

/**
 * Cleanup script to fix corrupted inventory data in the database
 * This script fixes double-JSON-encoded inventory data that was causing save errors
 */
async function cleanupInventoryData() {
    try {
        console.log('🔧 Starting inventory data cleanup...');

        // Get all players with inventory data
        const result = await pool.query('SELECT id, inventory FROM players WHERE inventory IS NOT NULL');

        let fixedCount = 0;
        let errorCount = 0;

        for (const row of result.rows) {
            try {
                let inventory = row.inventory;

                // If inventory is stored as a JSON string (corrupted), parse it
                if (typeof inventory === 'string') {
                    inventory = JSON.parse(inventory);
                }

                // Ensure it's an array and clean each item
                if (Array.isArray(inventory)) {
                    const cleanInventory = inventory.map(item => {
                        if (typeof item === 'string') {
                            try {
                                item = JSON.parse(item);
                            } catch (e) {
                                console.warn(`Skipping corrupted item for player ${row.id}:`, item);
                                return { type: 'air', count: 0 };
                            }
                        }

                        if (typeof item === 'object' && item !== null) {
                            return {
                                type: typeof item.type === 'string' ? item.type : 'air',
                                count: typeof item.count === 'number' ? item.count : 0
                            };
                        }

                        return { type: 'air', count: 0 };
                    });

                    // Update the database with cleaned inventory
                    await pool.query('UPDATE players SET inventory = $1 WHERE id = $2', [cleanInventory, row.id]);
                    fixedCount++;
                    console.log(`✅ Fixed inventory for player ${row.id}`);
                }
            } catch (err) {
                console.error(`❌ Failed to fix inventory for player ${row.id}:`, err);
                errorCount++;
            }
        }

        console.log(`🎉 Cleanup complete! Fixed ${fixedCount} players, ${errorCount} errors`);
    } catch (err) {
        console.error('❌ Cleanup failed:', err);
    } finally {
        await pool.end();
    }
}

// Run the cleanup
cleanupInventoryData();