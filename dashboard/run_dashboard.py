#!/usr/bin/env python3
"""
Kafka Dashboard Launcher
Run this to start the interactive Kafka monitoring dashboard
"""

import os
import sys
import argparse
import subprocess
from pathlib import Path


def check_dependencies():
    """Check if required Python packages are installed"""
    required_packages = [
        'dash', 'plotly', 'pandas', 'numpy', 'dash_bootstrap_components'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print("❌ Missing required packages:")
        for package in missing_packages:
            print(f"   - {package}")
        print("\n💡 Install missing packages with:")
        print("   pip install -r requirements.txt")
        return False
    
    return True


def find_data_directory():
    """Find the kafka-analysis directory"""
    current_dir = Path.cwd()
    
    # Common locations to check
    possible_paths = [
        current_dir / "kafka-analysis",
        current_dir / ".." / "kafka-analysis",
        current_dir / ".." / ".." / "kafka-analysis",
        Path.home() / "kafka-analysis"
    ]
    
    for path in possible_paths:
        if path.exists() and path.is_dir():
            return str(path)
    
    return None


def check_analysis_files(data_dir):
    """Check if analysis files exist in the data directory"""
    if not data_dir or not os.path.exists(data_dir):
        return False, []
    
    json_files = []
    for file in os.listdir(data_dir):
        if file.startswith('kafka-analysis-') and file.endswith('.json'):
            json_files.append(file)
    
    return len(json_files) > 0, json_files


def install_dependencies():
    """Install required dependencies"""
    print("📦 Installing required dependencies...")
    try:
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
        ])
        print("✅ Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Kafka Cluster Dashboard',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_dashboard.py                          # Run with auto-detected data directory
  python run_dashboard.py --data-dir ./reports    # Use custom data directory
  python run_dashboard.py --port 8080             # Run on different port
  python run_dashboard.py --install               # Install dependencies first
        """
    )
    
    parser.add_argument('--data-dir', 
                       help='Directory containing Kafka analysis reports')
    parser.add_argument('--port', type=int, default=8050,
                       help='Port to run dashboard on (default: 8050)')
    parser.add_argument('--host', default='127.0.0.1',
                       help='Host to bind to (default: 127.0.0.1)')
    parser.add_argument('--debug', action='store_true',
                       help='Run in debug mode')
    parser.add_argument('--install', action='store_true',
                       help='Install required dependencies first')
    
    args = parser.parse_args()
    
    # Change to dashboard directory
    dashboard_dir = Path(__file__).parent
    os.chdir(dashboard_dir)
    
    # Install dependencies if requested
    if args.install:
        if not install_dependencies():
            sys.exit(1)
    
    # Check dependencies
    if not check_dependencies():
        print("\n💡 Run with --install flag to install dependencies automatically:")
        print("   python run_dashboard.py --install")
        sys.exit(1)
    
    # Determine data directory
    if args.data_dir:
        data_dir = args.data_dir
    else:
        data_dir = find_data_directory()
        if not data_dir:
            data_dir = "../kafka-analysis"  # Default fallback
    
    # Check for analysis files
    has_files, json_files = check_analysis_files(data_dir)
    
    print("🚀 Kafka Dashboard Launcher")
    print("=" * 40)
    print(f"📁 Data directory: {os.path.abspath(data_dir)}")
    
    if not has_files:
        print("\n⚠️  No analysis files found!")
        print("💡 To generate analysis reports, run:")
        print("   cd /path/to/kafka-analyzer")
        print("   npx superstream-kafka-analyzer --config config.json")
        print("\n📝 The dashboard will still start but show 'No data available'")
    else:
        print(f"✅ Found {len(json_files)} analysis file(s)")
        print(f"📄 Latest: {max(json_files, key=lambda x: os.path.getmtime(os.path.join(data_dir, x)))}")
    
    print(f"\n🌐 Starting dashboard on http://{args.host}:{args.port}")
    print("⚡ Dashboard will auto-refresh every 30 seconds")
    print("🔄 Click 'Refresh Now' button to manually refresh")
    print("\n📊 Dashboard Features:")
    print("   • Real-time cluster health monitoring")
    print("   • Interactive charts and metrics")
    print("   • Health checks analysis")
    print("   • Topics and consumer groups overview")
    print("   • Historical trend analysis")
    
    try:
        # Import and run dashboard
        from app import KafkaDashboard
        
        dashboard = KafkaDashboard(data_dir=data_dir)
        dashboard.run(debug=args.debug, port=args.port, host=args.host)
        
    except KeyboardInterrupt:
        print("\n👋 Dashboard stopped by user")
    except Exception as e:
        print(f"\n❌ Error starting dashboard: {e}")
        print("💡 Try running with --debug flag for more details")
        sys.exit(1)


if __name__ == "__main__":
    main()
