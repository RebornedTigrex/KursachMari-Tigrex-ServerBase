#include "DatabaseModule.h"

DatabaseModule::DatabaseModule(boost::asio::io_context& ioc, const std::string& conn_str)
    : BaseModule("DatabaseModule", -1)
    , io_context_(ioc)
    , db_connection_string_(conn_str)
{}

DatabaseModule::~DatabaseModule() {
    shutdown();
}

bool DatabaseModule::onInitialize() {
    std::cout << "[DatabaseModule] Starting asynchronous DB initialization...\n";
    asyncInitializeDatabase();
    return true;
}

void DatabaseModule::asyncInitializeDatabase() {
    auto strand = boost::asio::make_strand(io_context_);

    boost::asio::post(strand, [this]() {
        try {
            conn_ = std::make_unique<pqxx::connection>(db_connection_string_);
            if (!conn_->is_open()) {
                throw std::runtime_error("Failed to open database connection");
            }

            pqxx::work txn(*conn_);
            txn.exec(init_schema_sql_);
            txn.commit();

            db_ready_.store(true);
            std::cout << "[DatabaseModule] Database schema initialized successfully. Ready!\n";
        }
        catch (const std::exception& e) {
            std::cerr << "[DatabaseModule] Database initialization error: " << e.what() << std::endl;
            db_ready_.store(false);
        }
        });
}

void DatabaseModule::onShutdown() {
    std::cout << "[DatabaseModule] Shutting down database module...\n";
    conn_.reset();
    db_ready_.store(false);
}