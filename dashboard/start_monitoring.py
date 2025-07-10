#!/usr/bin/env python3
"""
Kafka Analysis + Dashboard Integration
Runs the Kafka analyzer and then starts the dashboard
"""

import os
import sys
import subprocess
import time
import argparse
from pathlib import Path


def run_kafka_analysis(config_file=None, bootstrap_servers=None):
    """Run the Kafka analyzer to generate reports"""
    print("🔍 Running Kafka Analysis...")
    
    # Change to parent directory (where the analyzer is)
    original_dir = Path.cwd()
    analyzer_dir = Path(__file__).parent.parent
    os.chdir(analyzer_dir)
    
    try:
        # Build command
        cmd = ["node", "bin/index.js"]
        
        if config_file:
            cmd.extend(["--config", config_file])
        elif bootstrap_servers:
            cmd.extend(["--bootstrap-servers", bootstrap_servers])
        
        # Run analyzer
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Kafka analysis completed successfully!")
            return True
        else:
            print("❌ Kafka analysis failed:")
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Error running analyzer: {e}")
        return False
    finally:
        os.chdir(original_dir)


def start_dashboard(port=8050, host='127.0.0.1'):
    """Start the dashboard"""
    print("🚀 Starting Dashboard...")
    
    try:
        # Change to dashboard directory
        dashboard_dir = Path(__file__).parent
        os.chdir(dashboard_dir)
        
        # Start dashboard
        subprocess.run([
            sys.executable, "run_dashboard.py", 
            "--port", str(port),
            "--host", host
        ])
        
    except KeyboardInterrupt:
        print("\n👋 Dashboard stopped by user")
    except Exception as e:
        print(f"❌ Error starting dashboard: {e}")


def main():
    parser = argparse.ArgumentParser(
        description='Run Kafka analysis and start dashboard',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python start_monitoring.py --config ../kraft-config.json    # Use config file
  python start_monitoring.py --servers localhost:29092       # Use servers directly  
  python start_monitoring.py --dashboard-only                # Skip analysis, start dashboard only
        """
    )
    
    parser.add_argument('--config', 
                       help='Path to Kafka analyzer config file')
    parser.add_argument('--servers', 
                       help='Kafka bootstrap servers (comma-separated)')
    parser.add_argument('--port', type=int, default=8050,
                       help='Dashboard port (default: 8050)')
    parser.add_argument('--host', default='127.0.0.1',
                       help='Dashboard host (default: 127.0.0.1)')
    parser.add_argument('--dashboard-only', action='store_true',
                       help='Skip analysis, start dashboard only')
    parser.add_argument('--analyze-only', action='store_true',
                       help='Run analysis only, skip dashboard')
    
    args = parser.parse_args()
    
    print("🎯 Kafka Monitoring Setup")
    print("=" * 40)
    
    # Step 1: Run analysis (unless dashboard-only)
    if not args.dashboard_only:
        if not args.config and not args.servers:
            print("❌ Error: Must provide either --config or --servers")
            print("💡 Examples:")
            print("   python start_monitoring.py --config ../kraft-config.json")
            print("   python start_monitoring.py --servers localhost:29092")
            sys.exit(1)
        
        analysis_success = run_kafka_analysis(
            config_file=args.config,
            bootstrap_servers=args.servers
        )
        
        if not analysis_success:
            print("❌ Analysis failed. Dashboard will show 'No data available'")
            if not input("Continue with dashboard anyway? (y/N): ").lower().startswith('y'):
                sys.exit(1)
    
    # Step 2: Start dashboard (unless analyze-only)
    if not args.analyze_only:
        print(f"\n🌐 Dashboard will be available at: http://{args.host}:{args.port}")
        time.sleep(2)  # Give user time to read
        start_dashboard(port=args.port, host=args.host)
    else:
        print("✅ Analysis complete. Dashboard not started (--analyze-only flag)")


if __name__ == "__main__":
    main()
