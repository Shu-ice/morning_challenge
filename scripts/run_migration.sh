#!/bin/bash
# 🚀 Results Schema Migration Runner
# MongoDB結果スキーマ移行の簡単実行スクリプト

set -e  # エラー時に停止

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# スクリプトディレクトリの取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log_info "Results Schema Migration Tool"
log_info "Project Root: $PROJECT_ROOT"

# Node.jsの存在確認
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed or not in PATH"
    exit 1
fi

# .env.localファイルの存在確認
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
    log_warning ".env.local file not found"
    log_info "Make sure MONGODB_URI environment variable is set"
fi

# 使用方法の表示
show_usage() {
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  dryrun    - Analyze database without making changes (recommended first step)"
    echo "  migrate   - Execute the actual migration"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dryrun   # Safe analysis first"
    echo "  $0 migrate  # Actual migration"
    echo ""
}

# ドライラン実行
run_dryrun() {
    log_info "🔍 Starting dry run analysis..."
    log_warning "This will analyze your database without making any changes"
    
    cd "$PROJECT_ROOT"
    node scripts/migrate_results_schema_dryrun.js
    
    if [ $? -eq 0 ]; then
        log_success "Dry run completed successfully!"
        echo ""
        log_info "📋 Review the analysis report above"
        log_info "🚀 If everything looks good, run: $0 migrate"
    else
        log_error "Dry run failed!"
        exit 1
    fi
}

# 実際の移行実行
run_migration() {
    log_warning "⚠️  WARNING: This will modify your database!"
    log_info "💡 It is STRONGLY recommended to run dry run first: $0 dryrun"
    echo ""
    
    # 確認プロンプト
    read -p "Have you created a database backup? (y/N): " backup_confirm
    if [[ ! $backup_confirm =~ ^[Yy]$ ]]; then
        log_error "❌ Please create a database backup first!"
        log_info "💾 MongoDB backup command: mongodump --uri=\"\$MONGODB_URI\" --db=morning_challenge"
        exit 1
    fi
    
    read -p "Are you sure you want to proceed with the migration? (y/N): " migrate_confirm
    if [[ ! $migrate_confirm =~ ^[Yy]$ ]]; then
        log_info "❌ Migration cancelled by user"
        exit 0
    fi
    
    log_info "🚀 Starting migration..."
    
    cd "$PROJECT_ROOT"
    node scripts/migrate_results_schema.js
    
    if [ $? -eq 0 ]; then
        log_success "✅ Migration completed successfully!"
    else
        log_error "❌ Migration failed!"
        log_info "💡 Check the error logs above"
        log_info "🔄 You can safely retry the migration (it's idempotent)"
        exit 1
    fi
}

# メイン処理
main() {
    case "${1:-help}" in
        "dryrun")
            run_dryrun
            ;;
        "migrate")
            run_migration
            ;;
        "help"|"--help"|"-h")
            show_usage
            ;;
        *)
            log_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# スクリプト実行
main "$@"