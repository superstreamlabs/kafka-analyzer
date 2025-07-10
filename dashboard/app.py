"""
Main Kafka Dashboard Application
Interactive dashboard for monitoring Kafka cluster health and analytics
"""

import dash
from dash import dcc, html, Input, Output, callback, State
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
from datetime import datetime
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_loader import KafkaDataLoader, HistoricalDataProcessor
from components.charts import ChartBuilder, MetricsCards
from components.layout import LayoutComponents, TabsLayout


class KafkaDashboard:
    """Main dashboard application class"""
    
    def __init__(self, data_dir: str = "../kafka-analysis"):
        self.data_dir = data_dir
        self.data_loader = KafkaDataLoader(data_dir)
        self.chart_builder = ChartBuilder()
        self.layout_components = LayoutComponents()
        
        # Initialize Dash app
        self.app = dash.Dash(
            __name__,
            external_stylesheets=[
                dbc.themes.BOOTSTRAP,
                "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
            ],
            suppress_callback_exceptions=True
        )
        
        # Set custom CSS
        self.app.index_string = '''
        <!DOCTYPE html>
        <html>
            <head>
                {%metas%}
                <title>Kafka Dashboard</title>
                {%favicon%}
                {%css%}
                <style>
                    body {
                        font-family: 'Inter', sans-serif !important;
                        background-color: #f8f9fa;
                    }
                    .border-left-primary { border-left: 4px solid #007bff !important; }
                    .border-left-success { border-left: 4px solid #28a745 !important; }
                    .border-left-info { border-left: 4px solid #17a2b8 !important; }
                    .border-left-warning { border-left: 4px solid #ffc107 !important; }
                    .border-left-secondary { border-left: 4px solid #6c757d !important; }
                </style>
            </head>
            <body>
                {%app_entry%}
                <footer>
                    {%config%}
                    {%scripts%}
                    {%renderer%}
                </footer>
            </body>
        </html>
        '''
        
        self.setup_layout()
        self.setup_callbacks()
    
    def setup_layout(self):
        """Setup the main dashboard layout"""
        self.app.layout = dbc.Container([
            # Header
            self.layout_components.create_header(),
            
            # Refresh controls
            self.layout_components.create_refresh_controls(),
            
            # Main content area
            html.Div(id="main-content"),
            
            # Auto-refresh interval
            dcc.Interval(
                id='interval-component',
                interval=30*1000,  # Update every 30 seconds
                n_intervals=0
            ),
            
            # Data store
            dcc.Store(id='kafka-data'),
            dcc.Store(id='historical-data')
            
        ], fluid=True)
    
    def setup_callbacks(self):
        """Setup dashboard callbacks"""
        
        @self.app.callback(
            [Output('kafka-data', 'data'),
             Output('historical-data', 'data'),
             Output('last-updated', 'children')],
            [Input('interval-component', 'n_intervals'),
             Input('refresh-button', 'n_clicks')]
        )
        def update_data(n_intervals, refresh_clicks):
            """Update data from latest reports"""
            # Load latest report
            latest_data = self.data_loader.get_latest_report()
            
            # Load all reports for historical analysis
            all_reports = self.data_loader.get_all_reports()
            
            # Current timestamp
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            return latest_data, all_reports, current_time
        
        @self.app.callback(
            Output('main-content', 'children'),
            Input('kafka-data', 'data')
        )
        def update_main_content(kafka_data):
            """Update main content based on available data"""
            if not kafka_data:
                return self.layout_components.create_no_data_message()
            
            return self.create_dashboard_content(kafka_data)
        
    def create_dashboard_content(self, kafka_data):
        """Create the main dashboard content"""
        # Extract data summaries
        health_score = self.data_loader.get_health_score(kafka_data)
        topics_summary = self.data_loader.get_topics_summary(kafka_data)
        broker_info = self.data_loader.get_broker_info(kafka_data)
        consumer_summary = self.data_loader.get_consumer_groups_summary(kafka_data)
        
        # Create metrics cards
        metrics = MetricsCards.create_cluster_metrics(
            broker_info, topics_summary, consumer_summary
        )
        
        return html.Div([
            # Metrics cards
            self.layout_components.create_metrics_cards(metrics),
            
            # Charts row 1
            dbc.Row([
                dbc.Col([
                    self.layout_components.create_chart_card(
                        "health-score-gauge",
                        "Cluster Health Score",
                        "Overall health percentage based on passed checks"
                    )
                ], width=12, lg=4),
                dbc.Col([
                    self.layout_components.create_chart_card(
                        "health-checks-summary",
                        "Health Checks Summary",
                        "Breakdown of health check results"
                    )
                ], width=12, lg=4),
                dbc.Col([
                    self.layout_components.create_chart_card(
                        "topics-distribution",
                        "Topics Distribution",
                        "User vs Internal topics"
                    )
                ], width=12, lg=4)
            ], className="mb-4"),
            
            # Charts row 2
            dbc.Row([
                dbc.Col([
                    self.layout_components.create_chart_card(
                        "partitions-chart",
                        "Partitions per Topic",
                        "Distribution of partitions across user topics"
                    )
                ], width=12, lg=6),
                dbc.Col([
                    self.layout_components.create_chart_card(
                        "consumer-groups-chart",
                        "Consumer Groups Status",
                        "Active vs Inactive consumer groups"
                    )
                ], width=12, lg=6)
            ], className="mb-4"),
            
            # Charts row 3
            dbc.Row([
                dbc.Col([
                    self.layout_components.create_chart_card(
                        "replication-factor-chart",
                        "Replication Factor Distribution",
                        "Distribution of replication factors across topics"
                    )
                ], width=12, lg=6),
                dbc.Col([
                    self.layout_components.create_cluster_info_card("cluster-info")
                ], width=12, lg=6)
            ], className="mb-4"),
            
            # Health details table
            dbc.Row([
                dbc.Col([
                    self.layout_components.create_health_details_table("health-details-table")
                ], width=12)
            ]),
            
            # Hidden divs for charts data
            html.Div(id="chart-data", style={"display": "none"})
        ])
    
    def create_chart_callbacks(self):
        """Create callbacks for chart updates"""
        
        @self.app.callback(
            [Output('health-score-gauge', 'figure'),
             Output('health-checks-summary', 'figure'),
             Output('topics-distribution', 'figure'),
             Output('partitions-chart', 'figure'),
             Output('consumer-groups-chart', 'figure'),
             Output('replication-factor-chart', 'figure'),
             Output('cluster-info', 'children'),
             Output('health-details-table', 'children')],
            Input('kafka-data', 'data')
        )
        def update_charts(kafka_data):
            """Update all charts with new data"""
            if not kafka_data:
                # Return empty charts
                empty_fig = go.Figure()
                empty_content = html.Div("No data available")
                return (empty_fig, empty_fig, empty_fig, empty_fig, 
                       empty_fig, empty_fig, empty_content, empty_content)
            
            # Extract data
            health_score = self.data_loader.get_health_score(kafka_data)
            health_data = kafka_data.get('healthChecks', {})
            topics_summary = self.data_loader.get_topics_summary(kafka_data)
            topics = kafka_data.get('topics', [])
            consumer_groups = kafka_data.get('consumerGroups', [])
            broker_info = self.data_loader.get_broker_info(kafka_data)
            
            # Create charts
            health_gauge = self.chart_builder.create_health_score_gauge(health_score)
            health_summary = self.chart_builder.create_health_checks_summary(health_data)
            topics_dist = self.chart_builder.create_topics_distribution(topics_summary)
            partitions_chart = self.chart_builder.create_partitions_per_topic(topics)
            consumer_chart = self.chart_builder.create_consumer_groups_chart(consumer_groups)
            replication_chart = self.chart_builder.create_replication_factor_chart(topics)
            
            # Create cluster info
            cluster_info = self.create_cluster_info_content(kafka_data, broker_info)
            
            # Create health details table
            health_details = self.create_health_details_table(kafka_data)
            
            return (health_gauge, health_summary, topics_dist, partitions_chart,
                   consumer_chart, replication_chart, cluster_info, health_details)
    
    def create_cluster_info_content(self, kafka_data, broker_info):
        """Create cluster information content"""
        timestamp = kafka_data.get('timestamp', 'Unknown')
        vendor = kafka_data.get('vendor', 'Unknown')
        
        return html.Div([
            html.P([html.Strong("🏢 Vendor: "), vendor]),
            html.P([html.Strong("🆔 Cluster ID: "), broker_info.get('cluster_id', 'Unknown')]),
            html.P([html.Strong("👑 Controller: "), str(broker_info.get('controller', 'Unknown'))]),
            html.P([html.Strong("📅 Last Analysis: "), timestamp]),
            html.P([html.Strong("🖥️ Total Brokers: "), str(broker_info.get('total_brokers', 0))]),
            html.Hr(),
            html.H6("📡 Broker Details:"),
            html.Div([
                dbc.Badge(f"Broker {broker.get('nodeId', 'Unknown')}", 
                         color="secondary", className="me-2 mb-2")
                for broker in broker_info.get('brokers', [])
            ])
        ])
    
    def create_health_details_table(self, kafka_data):
        """Create health details table"""
        # Extract health check details
        health_details = self.data_loader.extract_health_checks_details(kafka_data)
        
        if not health_details:
            return html.Div([
                html.P("No health check details available", 
                      className="text-muted text-center p-4")
            ])
        
        # Process for table display
        table_data = []
        for check in health_details:
            table_data.append({
                'status': self.get_status_emoji(check.get('status', 'UNKNOWN')),
                'name': check.get('name', 'Unknown Check'),
                'message': check.get('message', 'No message'),
                'recommendation': check.get('recommendation', 'No recommendation')
            })
        
        return self.layout_components.create_data_table(table_data, "health-table")
    
    def get_status_emoji(self, status):
        """Get emoji for status"""
        status_map = {
            'PASSED': '✅ PASSED',
            'FAILED': '❌ FAILED',
            'WARNING': '⚠️ WARNING',
            'INFO': 'ℹ️ INFO'
        }
        return status_map.get(status, '? UNKNOWN')
    
    def run(self, debug=True, port=8050, host='127.0.0.1'):
        """Run the dashboard"""
        # Register chart callbacks
        self.create_chart_callbacks()
        
        print(f"🚀 Starting Kafka Dashboard on http://{host}:{port}")
        print(f"📁 Data directory: {os.path.abspath(self.data_dir)}")
        
        # Check if data directory exists
        if not os.path.exists(self.data_dir):
            print(f"⚠️  Warning: Data directory '{self.data_dir}' not found")
            print("💡 Run the Kafka analyzer first to generate reports")
        
        self.app.run_server(debug=debug, port=port, host=host)


if __name__ == "__main__":
    dashboard = KafkaDashboard()
    dashboard.run()
