"""
Data loader utilities for Kafka Dashboard
Handles loading and processing Kafka analysis reports
"""

import json
import os
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Any
import glob


class KafkaDataLoader:
    """Handles loading and processing Kafka analysis data"""
    
    def __init__(self, data_dir: str = "../kafka-analysis"):
        self.data_dir = data_dir
        
    def get_latest_report(self) -> Optional[Dict[str, Any]]:
        """Load the most recent Kafka analysis report"""
        try:
            if not os.path.exists(self.data_dir):
                return None
                
            # Find all JSON analysis files
            pattern = os.path.join(self.data_dir, "kafka-analysis-*.json")
            json_files = glob.glob(pattern)
            
            if not json_files:
                return None
            
            # Get the most recent file by modification time
            latest_file = max(json_files, key=os.path.getmtime)
            
            with open(latest_file, 'r') as f:
                data = json.load(f)
                
            # Add file metadata
            data['_metadata'] = {
                'filename': os.path.basename(latest_file),
                'filepath': latest_file,
                'last_modified': datetime.fromtimestamp(os.path.getmtime(latest_file)).isoformat()
            }
            
            return data
            
        except Exception as e:
            print(f"Error loading report: {e}")
            return None
    
    def get_all_reports(self) -> List[Dict[str, Any]]:
        """Load all available Kafka analysis reports"""
        try:
            if not os.path.exists(self.data_dir):
                return []
                
            pattern = os.path.join(self.data_dir, "kafka-analysis-*.json")
            json_files = glob.glob(pattern)
            
            reports = []
            for file_path in sorted(json_files, key=os.path.getmtime):
                try:
                    with open(file_path, 'r') as f:
                        data = json.load(f)
                        
                    # Add metadata
                    data['_metadata'] = {
                        'filename': os.path.basename(file_path),
                        'filepath': file_path,
                        'last_modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
                    }
                    
                    reports.append(data)
                except Exception as e:
                    print(f"Error loading {file_path}: {e}")
                    continue
                    
            return reports
            
        except Exception as e:
            print(f"Error loading reports: {e}")
            return []
    
    def get_health_score(self, data: Dict[str, Any]) -> float:
        """Calculate health score from analysis data"""
        if not data or 'healthChecks' not in data:
            return 0.0
            
        health_checks = data['healthChecks']
        total_checks = health_checks.get('totalChecks', 0)
        passed_checks = health_checks.get('passedChecks', 0)
        
        return (passed_checks / total_checks * 100) if total_checks > 0 else 0.0
    
    def get_topics_summary(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract topics summary from analysis data"""
        if not data:
            return {}
            
        summary = data.get('summary', {})
        topics = data.get('topics', [])
        
        # Calculate additional metrics
        user_topics = [t for t in topics if not t.get('isInternal', False)]
        internal_topics = [t for t in topics if t.get('isInternal', False)]
        
        total_partitions = sum(t.get('partitions', 0) for t in topics)
        avg_partitions = total_partitions / len(topics) if topics else 0
        
        return {
            'total_topics': len(topics),
            'user_topics': len(user_topics),
            'internal_topics': len(internal_topics),
            'total_partitions': total_partitions,
            'avg_partitions_per_topic': round(avg_partitions, 2),
            'topics_with_errors': sum(1 for t in topics if t.get('errorCode', 0) != 0)
        }
    
    def get_broker_info(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract broker information from analysis data"""
        if not data or 'clusterInfo' not in data:
            return {}
            
        cluster_info = data['clusterInfo']
        brokers = cluster_info.get('brokers', [])
        
        return {
            'total_brokers': len(brokers),
            'cluster_id': cluster_info.get('clusterId', 'Unknown'),
            'controller': cluster_info.get('controller', 'Unknown'),
            'brokers': brokers
        }
    
    def get_consumer_groups_summary(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract consumer groups summary"""
        if not data or 'consumerGroups' not in data:
            return {}
            
        consumer_groups = data['consumerGroups']
        
        active_groups = sum(1 for cg in consumer_groups if cg.get('members', 0) > 0)
        inactive_groups = len(consumer_groups) - active_groups
        
        return {
            'total_groups': len(consumer_groups),
            'active_groups': active_groups,
            'inactive_groups': inactive_groups,
            'groups': consumer_groups
        }
    
    def extract_health_checks_details(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract detailed health checks information"""
        if not data or 'healthChecks' not in data:
            return []
            
        health_checks = data['healthChecks']
        checks = health_checks.get('checks', [])
        
        detailed_checks = []
        for i, check in enumerate(checks):
            # Map the check details (this would need to be enhanced based on actual data structure)
            detailed_checks.append({
                'id': i,
                'name': f"Health Check {i+1}",
                'status': 'PASSED',  # This would come from actual data
                'message': check.get('description', 'No description available'),
                'recommendation': check.get('recommendation', 'No recommendation')
            })
            
        return detailed_checks


class HistoricalDataProcessor:
    """Process historical data for trend analysis"""
    
    def __init__(self, reports: List[Dict[str, Any]]):
        self.reports = reports
    
    def get_health_score_trend(self) -> pd.DataFrame:
        """Get health score trend over time"""
        data_loader = KafkaDataLoader()
        
        trend_data = []
        for report in self.reports:
            timestamp = report.get('timestamp', report.get('_metadata', {}).get('last_modified'))
            health_score = data_loader.get_health_score(report)
            
            trend_data.append({
                'timestamp': timestamp,
                'health_score': health_score,
                'total_checks': report.get('healthChecks', {}).get('totalChecks', 0),
                'passed_checks': report.get('healthChecks', {}).get('passedChecks', 0),
                'failed_checks': report.get('healthChecks', {}).get('failedChecks', 0)
            })
        
        df = pd.DataFrame(trend_data)
        if not df.empty:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.sort_values('timestamp')
            
        return df
    
    def get_topics_trend(self) -> pd.DataFrame:
        """Get topics trend over time"""
        trend_data = []
        for report in self.reports:
            timestamp = report.get('timestamp', report.get('_metadata', {}).get('last_modified'))
            summary = report.get('summary', {})
            
            trend_data.append({
                'timestamp': timestamp,
                'total_topics': summary.get('totalTopics', 0),
                'user_topics': summary.get('userTopics', 0),
                'total_partitions': summary.get('totalPartitions', 0)
            })
        
        df = pd.DataFrame(trend_data)
        if not df.empty:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.sort_values('timestamp')
            
        return df
