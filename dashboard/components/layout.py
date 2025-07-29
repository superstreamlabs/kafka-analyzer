"""
Layout components for Kafka Dashboard
Contains reusable UI components and layouts
"""

import dash_bootstrap_components as dbc
from dash import html, dcc, dash_table
from typing import List, Dict, Any


class LayoutComponents:
    """Collection of reusable layout components"""
    
    @staticmethod
    def create_header() -> dbc.Container:
        """Create dashboard header"""
        return dbc.Container([
            dbc.Row([
                dbc.Col([
                    html.Div([
                        html.H1([
                            "🚀 ",
                            html.Span("Kafka Cluster Dashboard", className="text-primary"),
                        ], className="text-center mb-3"),
                        html.P(
                            "Real-time monitoring and analysis of your Kafka cluster health",
                            className="text-center text-muted lead"
                        ),
                        html.Hr(className="my-4")
                    ])
                ], width=12)
            ])
        ], fluid=True, className="mb-4")
    
    @staticmethod
    def create_metrics_cards(metrics: List[Dict[str, Any]]) -> dbc.Row:
        """Create metrics cards row"""
        cards = []
        
        for metric in metrics:
            card = dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.Div([
                            html.Div([
                                html.H2(metric['icon'], className="text-center mb-0"),
                            ], className="col-auto"),
                            html.Div([
                                html.H4(str(metric['value']), className="mb-0 text-primary"),
                                html.P(metric['title'], className="text-muted small mb-0")
                            ], className="col")
                        ], className="row align-items-center")
                    ])
                ], className=f"border-left-{metric['color']} shadow-sm h-100")
            ], width=12, lg=2, className="mb-3")
            cards.append(card)
        
        return dbc.Row(cards)
    
    @staticmethod
    def create_chart_card(chart_id: str, title: str, description: str = "") -> dbc.Card:
        """Create a chart card wrapper"""
        return dbc.Card([
            dbc.CardHeader([
                html.H5(title, className="mb-0"),
                html.Small(description, className="text-muted") if description else None
            ]),
            dbc.CardBody([
                dcc.Graph(id=chart_id, config={'displayModeBar': False})
            ])
        ], className="shadow-sm h-100")
    
    @staticmethod
    def create_health_details_table(table_id: str) -> dbc.Card:
        """Create health details table card"""
        return dbc.Card([
            dbc.CardHeader([
                html.H5("📋 Detailed Health Checks", className="mb-0"),
                html.Small("Comprehensive analysis of cluster health", className="text-muted")
            ]),
            dbc.CardBody([
                html.Div(id=table_id)
            ])
        ], className="shadow-sm")
    
    @staticmethod
    def create_cluster_info_card(info_id: str) -> dbc.Card:
        """Create cluster information card"""
        return dbc.Card([
            dbc.CardHeader([
                html.H5("🏢 Cluster Information", className="mb-0"),
                html.Small("General cluster metadata and configuration", className="text-muted")
            ]),
            dbc.CardBody([
                html.Div(id=info_id)
            ])
        ], className="shadow-sm h-100")
    
    @staticmethod
    def create_status_badge(status: str) -> html.Span:
        """Create status badge based on health check status"""
        badge_config = {
            'PASSED': {'color': 'success', 'icon': '✅'},
            'FAILED': {'color': 'danger', 'icon': '❌'},
            'WARNING': {'color': 'warning', 'icon': '⚠️'},
            'INFO': {'color': 'info', 'icon': 'ℹ️'}
        }
        
        config = badge_config.get(status, {'color': 'secondary', 'icon': '?'})
        
        return dbc.Badge([
            config['icon'], " ", status
        ], color=config['color'], className="me-2")
    
    @staticmethod
    def create_data_table(data: List[Dict[str, Any]], table_id: str) -> dash_table.DataTable:
        """Create a styled data table"""
        if not data:
            return html.Div([
                html.P("No data available", className="text-muted text-center p-4")
            ])
        
        columns = [
            {"name": "Status", "id": "status", "type": "text"},
            {"name": "Health Check", "id": "name", "type": "text"},
            {"name": "Message", "id": "message", "type": "text"},
            {"name": "Recommendation", "id": "recommendation", "type": "text"}
        ]
        
        return dash_table.DataTable(
            id=table_id,
            data=data,
            columns=columns,
            style_cell={
                'textAlign': 'left',
                'whiteSpace': 'normal',
                'height': 'auto',
                'maxWidth': '300px',
                'fontFamily': 'Inter, Arial',
                'fontSize': '14px',
                'padding': '12px'
            },
            style_header={
                'backgroundColor': '#f8f9fa',
                'fontWeight': 'bold',
                'border': '1px solid #dee2e6'
            },
            style_data={
                'border': '1px solid #dee2e6',
                'backgroundColor': 'white'
            },
            style_data_conditional=[
                {
                    'if': {'filter_query': '{status} contains ✅'},
                    'backgroundColor': '#d4edda',
                    'color': 'black',
                },
                {
                    'if': {'filter_query': '{status} contains ❌'},
                    'backgroundColor': '#f8d7da',
                    'color': 'black',
                },
                {
                    'if': {'filter_query': '{status} contains ⚠️'},
                    'backgroundColor': '#fff3cd',
                    'color': 'black',
                },
                {
                    'if': {'filter_query': '{status} contains ℹ️'},
                    'backgroundColor': '#d1ecf1',
                    'color': 'black',
                }
            ],
            page_size=15,
            sort_action="native",
            filter_action="native",
            style_table={'overflowX': 'auto'}
        )
    
    @staticmethod
    def create_loading_spinner() -> dbc.Spinner:
        """Create loading spinner"""
        return dbc.Spinner([
            html.Div([
                html.H4("Loading Kafka data...", className="text-center text-muted"),
                html.P("Please wait while we fetch the latest analysis", className="text-center text-muted")
            ])
        ], size="lg", color="primary", type="border", fullscreen=True)
    
    @staticmethod
    def create_no_data_message() -> html.Div:
        """Create no data available message"""
        return html.Div([
            dbc.Alert([
                html.H4("📊 No Data Available", className="alert-heading"),
                html.P([
                    "No Kafka analysis reports found. Please run the analyzer first:"
                ]),
                html.Hr(),
                html.Pre([
                    "cd /path/to/kafka-analyzer\n",
                    "npx superstream-kafka-analyzer --config config.json"
                ], className="mb-0"),
                html.P([
                    html.Small("Then refresh this dashboard to view the results.")
                ], className="mb-0 mt-2")
            ], color="info", className="text-center")
        ], className="my-5")
    
    @staticmethod
    def create_refresh_controls() -> dbc.Row:
        """Create refresh controls section"""
        return dbc.Row([
            dbc.Col([
                dbc.ButtonGroup([
                    dbc.Button(
                        "🔄 Refresh Now",
                        id="refresh-button",
                        color="primary",
                        size="sm",
                        className="me-2"
                    ),
                    dbc.Button(
                        "⚙️ Settings",
                        id="settings-button",
                        color="outline-secondary",
                        size="sm"
                    )
                ])
            ], width="auto"),
            dbc.Col([
                html.Div([
                    html.Small("Last updated: ", className="text-muted"),
                    html.Small(id="last-updated", className="text-muted fw-bold")
                ])
            ], width="auto", className="ms-auto")
        ], className="mb-3 align-items-center")


class TabsLayout:
    """Layout for tabbed interface"""
    
    @staticmethod
    def create_tabs() -> dbc.Tabs:
        """Create main dashboard tabs"""
        return dbc.Tabs([
            dbc.Tab(label="📊 Overview", tab_id="overview"),
            dbc.Tab(label="🏥 Health Checks", tab_id="health"),
            dbc.Tab(label="📋 Topics", tab_id="topics"),
            dbc.Tab(label="👥 Consumer Groups", tab_id="consumers"),
            dbc.Tab(label="📈 Trends", tab_id="trends")
        ], id="main-tabs", active_tab="overview")
    
    @staticmethod
    def create_tab_content() -> html.Div:
        """Create tab content container"""
        return html.Div(id="tab-content", className="mt-4")
