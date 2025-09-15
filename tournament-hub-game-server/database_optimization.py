import logging
import sqlite3
import time
from typing import Optional, Dict, Any
import threading

logger = logging.getLogger(__name__)

class DatabaseOptimizer:
    def __init__(self, db_path: str = "tournament_hub.db"):
        self.db_path = db_path
        self.lock = threading.Lock()
        self._init_database()
    
    def _init_database(self):
        """Initialize the database with required tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create API requests table for analytics
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS api_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        endpoint TEXT NOT NULL,
                        method TEXT NOT NULL,
                        status_code INTEGER NOT NULL,
                        response_time_ms INTEGER NOT NULL,
                        user_agent TEXT,
                        ip_address TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create performance stats table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS performance_stats (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        metric_name TEXT NOT NULL,
                        metric_value REAL NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                conn.commit()
                logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
    
    def log_api_request(self, endpoint: str, method: str, status_code: int, 
                       response_time_ms: int, user_agent: Optional[str] = None, 
                       ip_address: Optional[str] = None):
        """Log an API request for analytics"""
        try:
            with self.lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO api_requests 
                        (endpoint, method, status_code, response_time_ms, user_agent, ip_address)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (endpoint, method, status_code, response_time_ms, user_agent, ip_address))
                    conn.commit()
        except Exception as e:
            logger.error(f"Failed to log API request: {e}")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics from the database"""
        try:
            with self.lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Get average response time
                    cursor.execute('''
                        SELECT AVG(response_time_ms) as avg_response_time,
                               COUNT(*) as total_requests,
                               COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
                        FROM api_requests
                        WHERE timestamp > datetime('now', '-1 hour')
                    ''')
                    
                    result = cursor.fetchone()
                    
                    if result and result[0] is not None:
                        return {
                            "avg_response_time_ms": round(result[0], 2),
                            "total_requests": result[1],
                            "error_count": result[2],
                            "error_rate": round((result[2] / result[1]) * 100, 2) if result[1] > 0 else 0
                        }
                    else:
                        return {
                            "avg_response_time_ms": 0,
                            "total_requests": 0,
                            "error_count": 0,
                            "error_rate": 0
                        }
        except Exception as e:
            logger.error(f"Failed to get performance stats: {e}")
            return {
                "avg_response_time_ms": 0,
                "total_requests": 0,
                "error_count": 0,
                "error_rate": 0
            }
    
    def optimize_database(self):
        """Perform database optimization tasks"""
        try:
            with self.lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Clean up old API request logs (keep only last 7 days)
                    cursor.execute('''
                        DELETE FROM api_requests 
                        WHERE timestamp < datetime('now', '-7 days')
                    ''')
                    
                    # Clean up old performance stats (keep only last 30 days)
                    cursor.execute('''
                        DELETE FROM performance_stats 
                        WHERE timestamp < datetime('now', '-30 days')
                    ''')
                    
                    # Vacuum the database to reclaim space
                    cursor.execute('VACUUM')
                    
                    conn.commit()
                    logger.info("Database optimization completed")
        except Exception as e:
            logger.error(f"Failed to optimize database: {e}")

# Create a global instance
db_optimizer = DatabaseOptimizer()
