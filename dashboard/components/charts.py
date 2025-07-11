"""
Chart components for Kafka Dashboard
Contains all chart generation functions using Plotly
"""

import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
from typing import Dict, List, Any, Optional


class ChartBuilder:
    """Builder class for creating Plotly charts"""
    
    @staticmethod
    def create_health_score_gauge(health_score: float, title: str = "Cluster Health Score") -> go.Figure:
        """Create a health score gauge chart"""
        
        # Determine color based on score
        if health_score >= 90:
            color = "#28a745"  # Green
        elif health_score >= 70:
            color = "#ffc107"  # Yellow
        else:
            color = "#dc3545"  # Red
        
        fig = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=health_score,
            domain={'x': [0, 1], 'y': [0, 1]},
            title={'text': title, 'font': {'size': 20}},
            delta={'reference': 90, 'relative': True, 'valueformat': '.1%'},
            gauge={
                'axis': {'range': [None, 100], 'tickwidth': 1, 'tickcolor': "darkblue"},
                'bar': {'color': color},
                'bgcolor': "white",
                'borderwidth': 2,
                'bordercolor': "gray",
                'steps': [
                    {'range': [0, 50], 'color': '#f8d7da'},
                    {'range': [50, 70], 'color': '#fff3cd'},
                    {'range': [70, 90], 'color': '#d1ecf1'},
                    {'range': [90, 100], 'color': '#d4edda'}
                ],
                'threshold': {
                    'line': {'color': "red", 'width': 4},
                    'thickness': 0.75,
                    'value': 90
                }
            }
        ))
        
        fig.update_layout(
            height=350,
            font={'color': "darkblue", 'family': "Inter, Arial"},
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)'
        )
        
        return fig
    
    @staticmethod
    def create_health_checks_summary(health_data: Dict[str, int]) -> go.Figure:
        """Create health checks summary bar chart"""
        
        categories = ['Passed', 'Failed', 'Warnings']
        values = [
            health_data.get('passedChecks', 0),
            health_data.get('failedChecks', 0),
            health_data.get('warnings', 0)
        ]
        colors = ['#28a745', '#dc3545', '#ffc107']
        
        fig = go.Figure()
        
        for i, (category, value, color) in enumerate(zip(categories, values, colors)):
            fig.add_trace(go.Bar(
                x=[category],
                y=[value],
                name=category,
                marker_color=color,
                text=[value],
                textposition='auto',
                hovertemplate=f'<b>{category}</b><br>Count: %{{y}}<extra></extra>'
            ))
        
        fig.update_layout(
            title="Health Checks Summary",
            xaxis_title="Status",
            yaxis_title="Count",
            height=350,
            showlegend=False,
            font={'family': "Inter, Arial"},
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            xaxis={'gridcolor': '#e0e0e0'},
            yaxis={'gridcolor': '#e0e0e0'}
        )
        
        return fig
    
    @staticmethod
    def create_topics_distribution(topics_data: Dict[str, int]) -> go.Figure:
        """Create topics distribution pie chart"""
        
        labels = ['User Topics', 'Internal Topics']
        values = [
            topics_data.get('user_topics', 0),
            topics_data.get('internal_topics', 0)
        ]
        colors = ['#007bff', '#6c757d']
        
        fig = go.Figure(data=[
            go.Pie(
                labels=labels,
                values=values,
                hole=0.4,
                marker_colors=colors,
                textinfo='label+percent+value',
                hovertemplate='<b>%{label}</b><br>Count: %{value}<br>Percentage: %{percent}<extra></extra>'
            )
        ])
        
        fig.update_layout(
            title="Topics Distribution",
            height=350,
            font={'family': "Inter, Arial"},
            paper_bgcolor='rgba(0,0,0,0)',
            annotations=[
                dict(text=f'Total<br>{sum(values)}', x=0.5, y=0.5, font_size=20, showarrow=False)
            ]
        )
        
        return fig
    
    @staticmethod
    def create_partitions_per_topic(topics: List[Dict[str, Any]]) -> go.Figure:
        """Create partitions per topic bar chart"""
        
        # Filter out internal topics and prepare data
        user_topics = [t for t in topics if not t.get('isInternal', False)]
        
        if not user_topics:
            # Create empty chart
            fig = go.Figure()
            fig.add_annotation(
                text="No user topics found",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False,
                font={'size': 16, 'color': '#6c757d'}
            )
        else:
            topic_names = [t['name'] for t in user_topics]
            partition_counts = [t.get('partitions', 0) for t in user_topics]
            
            fig = go.Figure(data=[
                go.Bar(
                    x=topic_names,
                    y=partition_counts,
                    marker_color='lightblue',
                    text=partition_counts,
                    textposition='auto',
                    hovertemplate='<b>%{x}</b><br>Partitions: %{y}<extra></extra>'
                )
            ])
        
        fig.update_layout(
            title="Partitions per Topic",
            xaxis_title="Topics",
            yaxis_title="Partition Count",
            height=350,
            font={'family': "Inter, Arial"},
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            xaxis={'tickangle': -45, 'gridcolor': '#e0e0e0'},
            yaxis={'gridcolor': '#e0e0e0'}
        )
        
        return fig
    
    @staticmethod
    def create_consumer_groups_chart(consumer_groups: List[Dict[str, Any]]) -> go.Figure:
        """Create consumer groups status chart"""
        
        if not consumer_groups:
            fig = go.Figure()
            fig.add_annotation(
                text="No consumer groups found",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False,
                font={'size': 16, 'color': '#6c757d'}
            )
            fig.update_layout(height=350, title="Consumer Groups Status")
            return fig
        
        # Count groups by status
        active_count = sum(1 for cg in consumer_groups if cg.get('members', 0) > 0)
        inactive_count = len(consumer_groups) - active_count
        
        labels = ['Active', 'Inactive']
        values = [active_count, inactive_count]
        colors = ['#28a745', '#ffc107']
        
        fig = go.Figure(data=[
            go.Pie(
                labels=labels,
                values=values,
                marker_colors=colors,
                textinfo='label+percent+value',
                hovertemplate='<b>%{label}</b><br>Count: %{value}<br>Percentage: %{percent}<extra></extra>'
            )
        ])
        
        fig.update_layout(
            title="Consumer Groups Status",
            height=350,
            font={'family': "Inter, Arial"},
            paper_bgcolor='rgba(0,0,0,0)'
        )
        
        return fig
    
    @staticmethod
    def create_replication_factor_chart(topics: List[Dict[str, Any]]) -> go.Figure:
        """Create replication factor distribution chart"""
        
        if not topics:
            fig = go.Figure()
            fig.add_annotation(
                text="No topics found",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False,
                font={'size': 16, 'color': '#6c757d'}
            )
            fig.update_layout(height=350, title="Replication Factor Distribution")
            return fig
        
        # Count topics by replication factor
        rf_counts = {}
        for topic in topics:
            rf = topic.get('replicationFactor', 1)
            rf_counts[rf] = rf_counts.get(rf, 0) + 1
        
        rfs = list(rf_counts.keys())
        counts = list(rf_counts.values())
        
        fig = go.Figure(data=[
            go.Bar(
                x=[f"RF={rf}" for rf in rfs],
                y=counts,
                marker_color='lightcoral',
                text=counts,
                textposition='auto',
                hovertemplate='<b>%{x}</b><br>Topics: %{y}<extra></extra>'
            )
        ])
        
        fig.update_layout(
            title="Replication Factor Distribution",
            xaxis_title="Replication Factor",
            yaxis_title="Number of Topics",
            height=350,
            font={'family': "Inter, Arial"},
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            xaxis={'gridcolor': '#e0e0e0'},
            yaxis={'gridcolor': '#e0e0e0'}
        )
        
        return fig
    
    @staticmethod
    def create_health_score_trend(trend_df: pd.DataFrame) -> go.Figure:
        """Create health score trend line chart"""
        
        if trend_df.empty:
            fig = go.Figure()
            fig.add_annotation(
                text="No historical data available",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False,
                font={'size': 16, 'color': '#6c757d'}
            )
            fig.update_layout(height=350, title="Health Score Trend")
            return fig
        
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=trend_df['timestamp'],
            y=trend_df['health_score'],
            mode='lines+markers',
            name='Health Score',
            line=dict(color='#007bff', width=3),
            marker=dict(size=8),
            hovertemplate='<b>Health Score</b><br>Date: %{x}<br>Score: %{y:.1f}%<extra></extra>'
        ))
        
        # Add threshold line
        fig.add_hline(
            y=90, 
            line_dash="dash", 
            line_color="red",
            annotation_text="Target: 90%",
            annotation_position="bottom right"
        )
        
        fig.update_layout(
            title="Health Score Trend",
            xaxis_title="Time",
            yaxis_title="Health Score (%)",
            height=350,
            font={'family': "Inter, Arial"},
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            xaxis={'gridcolor': '#e0e0e0'},
            yaxis={'gridcolor': '#e0e0e0', 'range': [0, 100]}
        )
        
        return fig


class MetricsCards:
    """Helper class for creating metric cards data"""
    
    @staticmethod
    def create_cluster_metrics(cluster_info: Dict[str, Any], topics_summary: Dict[str, Any], 
                             consumer_summary: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create metrics cards data"""
        
        metrics = [
            {
                'title': 'Total Brokers',
                'value': cluster_info.get('total_brokers', 0),
                'icon': '🖥️',
                'color': 'primary'
            },
            {
                'title': 'Total Topics',
                'value': topics_summary.get('total_topics', 0),
                'icon': '📋',
                'color': 'info'
            },
            {
                'title': 'Total Partitions',
                'value': topics_summary.get('total_partitions', 0),
                'icon': '📊',
                'color': 'success'
            },
            {
                'title': 'Consumer Groups',
                'value': consumer_summary.get('total_groups', 0),
                'icon': '👥',
                'color': 'warning'
            },
            {
                'title': 'Active Groups',
                'value': consumer_summary.get('active_groups', 0),
                'icon': '✅',
                'color': 'success'
            },
            {
                'title': 'Avg Partitions/Topic',
                'value': f"{topics_summary.get('avg_partitions_per_topic', 0):.1f}",
                'icon': '⚖️',
                'color': 'secondary'
            }
        ]
        
        return metrics
