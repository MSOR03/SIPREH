"""
Cloud storage service for managing parquet files.
Supports multiple providers: Cloudflare R2, AWS S3, Backblaze B2, etc.
"""
import boto3
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO
import hashlib
from app.core.config import settings


class CloudStorageService:
    """Service for interacting with cloud storage."""
    
    def __init__(self):
        """Initialize cloud storage client."""
        self.client = boto3.client(
            's3',
            endpoint_url=settings.CLOUD_STORAGE_ENDPOINT,
            aws_access_key_id=settings.CLOUD_STORAGE_ACCESS_KEY,
            aws_secret_access_key=settings.CLOUD_STORAGE_SECRET_KEY,
            region_name=settings.CLOUD_STORAGE_REGION,
        )
        self.bucket = settings.CLOUD_STORAGE_BUCKET
    
    def upload_file(
        self, 
        file_obj: BinaryIO, 
        object_key: str,
        metadata: Optional[dict] = None
    ) -> tuple[bool, str]:
        """
        Upload a file to cloud storage.
        
        Args:
            file_obj: File object to upload
            object_key: Key/path for the object in storage
            metadata: Optional metadata dictionary
            
        Returns:
            Tuple of (success, url_or_error_message)
        """
        try:
            extra_args = {}
            if metadata:
                extra_args['Metadata'] = metadata
            
            self.client.upload_fileobj(
                file_obj,
                self.bucket,
                object_key,
                ExtraArgs=extra_args
            )
            
            # Generate URL
            url = f"{settings.CLOUD_STORAGE_ENDPOINT}/{self.bucket}/{object_key}"
            return True, url
            
        except ClientError as e:
            return False, str(e)
    
    def download_file(self, object_key: str) -> Optional[bytes]:
        """
        Download a file from cloud storage.
        
        Args:
            object_key: Key/path of the object in storage
            
        Returns:
            File content as bytes or None if error
        """
        try:
            response = self.client.get_object(
                Bucket=self.bucket,
                Key=object_key
            )
            return response['Body'].read()
        except ClientError as e:
            print(f"Error downloading file: {e}")
            return None
    
    def get_file_url(self, object_key: str, expires_in: int = 3600) -> Optional[str]:
        """
        Generate a presigned URL for file access.
        
        Args:
            object_key: Key/path of the object in storage
            expires_in: URL expiration time in seconds
            
        Returns:
            Presigned URL or None if error
        """
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': object_key},
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            print(f"Error generating presigned URL: {e}")
            return None
    
    def delete_file(self, object_key: str) -> bool:
        """
        Delete a file from cloud storage.
        
        Args:
            object_key: Key/path of the object in storage
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.client.delete_object(
                Bucket=self.bucket,
                Key=object_key
            )
            return True
        except ClientError as e:
            print(f"Error deleting file: {e}")
            return False
    
    def list_files(self, prefix: str = "") -> list[dict]:
        """
        List files in cloud storage.
        
        Args:
            prefix: Optional prefix to filter files
            
        Returns:
            List of file information dictionaries
        """
        try:
            response = self.client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix
            )
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'],
                    'etag': obj['ETag']
                })
            return files
        except ClientError as e:
            print(f"Error listing files: {e}")
            return []
    
    @staticmethod
    def calculate_file_hash(file_obj: BinaryIO) -> str:
        """
        Calculate MD5 hash of a file.
        
        Args:
            file_obj: File object
            
        Returns:
            MD5 hash as hex string
        """
        md5_hash = hashlib.md5()
        file_obj.seek(0)
        for chunk in iter(lambda: file_obj.read(4096), b""):
            md5_hash.update(chunk)
        file_obj.seek(0)
        return md5_hash.hexdigest()


# Singleton instance
cloud_storage = CloudStorageService()
