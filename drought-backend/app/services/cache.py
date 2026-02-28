"""
Cache service for improving performance with large datasets.
Supports both in-memory and Redis caching.
"""
import json
import hashlib
from typing import Optional, Any
from datetime import timedelta
import pickle


class CacheService:
    """
    Cache service with fallback from Redis to in-memory.
    """
    
    def __init__(self):
        """Initialize cache service."""
        self.memory_cache = {}
        self.redis_client = None
        
        # Try to connect to Redis if available
        try:
            import redis
            from app.core.config import settings
            
            # Redis connection (optional)
            if hasattr(settings, 'REDIS_URL'):
                self.redis_client = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=False
                )
                print("✓ Redis cache connected")
        except (ImportError, Exception) as e:
            print(f"ℹ Redis not available, using memory cache: {e}")
    
    def _generate_key(self, prefix: str, **kwargs) -> str:
        """
        Generate cache key from parameters.
        
        Args:
            prefix: Key prefix
            **kwargs: Parameters to include in key
            
        Returns:
            Cache key string
        """
        # Sort kwargs for consistent key generation
        sorted_params = sorted(kwargs.items())
        param_str = json.dumps(sorted_params, sort_keys=True)
        hash_str = hashlib.md5(param_str.encode()).hexdigest()
        return f"{prefix}:{hash_str}"
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None
        """
        # Try Redis first
        if self.redis_client:
            try:
                value = self.redis_client.get(key)
                if value:
                    return pickle.loads(value)
            except Exception as e:
                print(f"Redis get error: {e}")
        
        # Fallback to memory cache
        return self.memory_cache.get(key)
    
    def set(
        self, 
        key: str, 
        value: Any, 
        expire: int = 3600
    ) -> bool:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            expire: Expiration time in seconds (default 1 hour)
            
        Returns:
            True if successful
        """
        # Try Redis first
        if self.redis_client:
            try:
                serialized = pickle.dumps(value)
                self.redis_client.setex(key, expire, serialized)
                return True
            except Exception as e:
                print(f"Redis set error: {e}")
        
        # Fallback to memory cache (with simple expiration tracking)
        self.memory_cache[key] = value
        return True
    
    def delete(self, key: str) -> bool:
        """
        Delete key from cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if successful
        """
        if self.redis_client:
            try:
                self.redis_client.delete(key)
            except Exception as e:
                print(f"Redis delete error: {e}")
        
        if key in self.memory_cache:
            del self.memory_cache[key]
        
        return True
    
    def clear_pattern(self, pattern: str) -> int:
        """
        Clear all keys matching pattern.
        
        Args:
            pattern: Pattern to match (e.g., "dashboard:*")
            
        Returns:
            Number of keys deleted
        """
        count = 0
        
        if self.redis_client:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    count = self.redis_client.delete(*keys)
            except Exception as e:
                print(f"Redis clear pattern error: {e}")
        
        # Clear from memory cache
        keys_to_delete = [k for k in self.memory_cache.keys() if pattern.replace('*', '') in k]
        for key in keys_to_delete:
            del self.memory_cache[key]
            count += 1
        
        return count


# Singleton instance
cache_service = CacheService()
