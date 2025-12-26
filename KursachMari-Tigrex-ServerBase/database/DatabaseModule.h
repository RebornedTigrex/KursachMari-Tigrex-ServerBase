#pragma once

#include "BaseModule.h"
#include <boost/asio.hpp>
#include <boost/asio/strand.hpp>
#include <pqxx/pqxx>
#include <memory>
#include <iostream>

class DatabaseModule : public BaseModule {
private:
    std::string db_connection_string_;

    boost::asio::io_context& io_context_;

    std::unique_ptr<pqxx::connection> conn_;
    std::atomic<bool> db_ready_{ false };

    const std::string init_schema_sql_ = R"(
        -- Команда агентства
        CREATE TABLE IF NOT EXISTS team (
            id SERIAL PRIMARY KEY,
            fullname TEXT NOT NULL,
            role TEXT NOT NULL,                     -- Например: Аккаунт-менеджер, Креативный директор, Медиапланер
            workload NUMERIC(5,2) DEFAULT 0,         -- Процент загрузки (0-100)
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Рабочие часы / нагрузка (можно использовать для расчёта workload)
        CREATE TABLE IF NOT EXISTS work_hours (
            employee_id INTEGER PRIMARY KEY REFERENCES team(id) ON DELETE CASCADE,
            regular_hours NUMERIC(8,2) DEFAULT 0,
            overtime NUMERIC(8,2) DEFAULT 0,
            undertime NUMERIC(8,2) DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Клиенты агентства
        CREATE TABLE IF NOT EXISTS clients (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            contact TEXT,
            status TEXT NOT NULL CHECK (status IN ('active', 'prospect', 'archived')) DEFAULT 'prospect',
            total_budget NUMERIC(15,2) DEFAULT 0,
            campaigns_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Рекламные кампании
        CREATE TABLE IF NOT EXISTS campaigns (
            id SERIAL PRIMARY KEY,
            client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('planning', 'running', 'completed', 'paused')) DEFAULT 'planning',
            budget NUMERIC(15,2) NOT NULL DEFAULT 0,
            spent NUMERIC(15,2) DEFAULT 0,
            start_date DATE,
            end_date DATE,
            roi NUMERIC(6,2),                        -- ROI только для завершённых кампаний
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Задачи по кампаниям
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            assignee_id INTEGER REFERENCES team(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
            due_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT TIMESTAMP
        );

        -- Автоматическое обновление updated_at для всех таблиц с этим полем
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Применяем триггер ко всем таблицам, где есть updated_at
        DROP TRIGGER IF EXISTS trg_update_team ON team;
        CREATE TRIGGER trg_update_team
            BEFORE UPDATE ON team
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS trg_update_clients ON clients;
        CREATE TRIGGER trg_update_clients
            BEFORE UPDATE ON clients
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS trg_update_campaigns ON campaigns;
        CREATE TRIGGER trg_update_campaigns
            BEFORE UPDATE ON campaigns
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS trg_update_tasks ON tasks;
        CREATE TRIGGER trg_update_tasks
            BEFORE UPDATE ON tasks
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS trg_update_work_hours ON work_hours;
        CREATE TRIGGER trg_update_work_hours
            BEFORE UPDATE ON work_hours
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    )";

public:
    explicit DatabaseModule(
        boost::asio::io_context& ioc,
        const std::string& conn_str = "dbname=postgres user=postgres password=postgres host=127.0.0.1 port=5432"
    );

    ~DatabaseModule() override;

    DatabaseModule(const DatabaseModule&) = delete;
    DatabaseModule& operator=(const DatabaseModule&) = delete;

    pqxx::connection* getConnection() {
        return db_ready_.load() ? conn_.get() : nullptr;
    }

    bool isDatabaseReady() const { return db_ready_.load(); }

protected:
    bool onInitialize() override;
    void onShutdown() override;

private:
    void asyncInitializeDatabase();
};