#include "ApiProcessor.h"
#include "DatabaseModule.h"

#include <boost/algorithm/string.hpp>
#include <boost/json.hpp>
#include <pqxx/pqxx>

#include <iostream>
#include <regex>

namespace bj = boost::json;
namespace http = boost::beast::http;

ApiProcessor::ApiProcessor(DatabaseModule* db_module) : db_module_(db_module) {}

pqxx::connection* ApiProcessor::getConn() {
    if (!db_module_ || !db_module_->isDatabaseReady()) {
        return nullptr;
    }
    return db_module_->getConnection();
}

void ApiProcessor::sendJsonError(http::response<http::string_body>& res,
    http::status status,
    const std::string& message) {
    bj::object err;
    err["error"] = message;
    res.result(status);
    res.set(http::field::content_type, "application/json");
    res.body() = bj::serialize(err);
    res.prepare_payload();
}

// Конвертеры
bj::object ApiProcessor::clientToJson(const pqxx::row& row) {
    bj::object obj;
    obj["id"] = row["id"].as<int>();
    obj["name"] = row["name"].c_str();
    obj["contact"] = row["contact"].is_null() ? "" : row["contact"].c_str();
    obj["status"] = row["status"].c_str();
    obj["totalBudget"] = row["total_budget"].as<double>();
    obj["campaignsCount"] = row["campaigns_count"].as<int>();
    return obj;
}

bj::object ApiProcessor::campaignToJson(const pqxx::row& row) {
    bj::object obj;
    obj["id"] = row["id"].as<int>();
    obj["clientId"] = row["client_id"].as<int>();
    obj["name"] = row["name"].c_str();
    obj["status"] = row["status"].c_str();
    obj["budget"] = row["budget"].as<double>();
    obj["spent"] = row["spent"].as<double>();

    // start_date, end_date, roi — могут быть NULL
    if (row["start_date"].is_null()) {
        obj["startDate"] = nullptr;  // boost::json понимает nullptr как null
    }
    else {
        obj["startDate"] = row["start_date"].c_str();
    }

    if (row["end_date"].is_null()) {
        obj["endDate"] = nullptr;
    }
    else {
        obj["endDate"] = row["end_date"].c_str();
    }

    if (row["roi"].is_null()) {
        obj["roi"] = nullptr;  // Вот здесь правильный способ!
    }
    else {
        obj["roi"] = row["roi"].as<double>();
    }

    return obj;
}

bj::object ApiProcessor::taskToJson(const pqxx::row& row) {
    bj::object obj;
    obj["id"] = row["id"].as<int>();
    obj["campaignId"] = row["campaign_id"].as<int>();

    if (row["assignee_id"].is_null()) {
        obj["assigneeId"] = nullptr;
    }
    else {
        obj["assigneeId"] = row["assignee_id"].as<int>();
    }

    obj["title"] = row["title"].c_str();

    if (row["description"].is_null()) {
        obj["description"] = nullptr;
    }
    else {
        obj["description"] = row["description"].c_str();
    }

    obj["status"] = row["status"].c_str();

    if (row["due_date"].is_null()) {
        obj["dueDate"] = nullptr;
    }
    else {
        obj["dueDate"] = row["due_date"].c_str();
    }

    return obj;
}

bj::object ApiProcessor::teamMemberToJson(const pqxx::row& row) {
    bj::object obj;
    obj["id"] = row["id"].as<int>();
    obj["fullname"] = row["fullname"].c_str();
    obj["role"] = row["role"].c_str();
    obj["workload"] = row["workload"].as<double>();
    return obj;
}

std::optional<std::string> ApiProcessor::getQueryParam(const std::string& target,
    const std::string& param_name) {
    size_t pos = target.find('?');
    if (pos == std::string::npos) return std::nullopt;

    std::string query = target.substr(pos + 1);
    std::vector<std::string> pairs;
    boost::split(pairs, query, boost::is_any_of("&"));

    for (const auto& pair : pairs) {
        std::vector<std::string> kv;
        boost::split(kv, pair, boost::is_any_of("="));
        if (kv.size() == 2 && kv[0] == param_name) {
            return kv[1];
        }
    }
    return std::nullopt;
}

std::optional<int> ApiProcessor::parseIdFromPath(const std::string& path,
    const std::string& prefix) {
    std::regex re(prefix + "(\\d+)");
    std::smatch match;
    if (std::regex_search(path, match, re) && match.size() > 1) {
        return std::stoi(match.str(1));
    }
    return std::nullopt;
}

void ApiProcessor::handleGetAllData(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) {
        return sendJsonError(res, http::status::service_unavailable, "Database not ready");
    }

    if (req.method() != http::verb::get) {
        return sendJsonError(res, http::status::method_not_allowed, "Only GET allowed");
    }

    try {
        pqxx::work txn(*conn);

        // Дашборд: вычисления на сервере
        bj::object dashboard;

        // Активные клиенты
        auto active_clients_res = txn.exec("SELECT COUNT(*) FROM clients WHERE status = 'active'");
        int active_clients = active_clients_res[0][0].as<int>();

        // Активные кампании и бюджеты
        auto campaigns_agg = txn.exec(R"(
            SELECT 
                COUNT(*) AS running_count,
                COALESCE(SUM(budget), 0) AS total_budget,
                COALESCE(SUM(spent), 0) AS total_spent
            FROM campaigns 
            WHERE status = 'running'
        )");
        int active_campaigns = campaigns_agg[0]["running_count"].as<int>();
        double total_budget = campaigns_agg[0]["total_budget"].as<double>();
        double total_spent = campaigns_agg[0]["total_spent"].as<double>();

        // Средний ROI по завершённым кампаниям
        auto roi_res = txn.exec(R"(
            SELECT AVG(roi) AS avg_roi 
            FROM campaigns 
            WHERE status = 'completed' AND roi IS NOT NULL
        )");
        double avg_roi = roi_res[0]["avg_roi"].is_null() ? 0.0 : roi_res[0]["avg_roi"].as<double>();

        // Средняя загрузка команды
        auto workload_res = txn.exec("SELECT AVG(workload) AS avg_workload FROM team");
        double team_workload = workload_res[0]["avg_workload"].is_null() ? 0.0 : workload_res[0]["avg_workload"].as<double>();
        team_workload = std::round(team_workload);

        dashboard["activeClients"] = active_clients;
        dashboard["activeCampaigns"] = active_campaigns;
        dashboard["totalBudget"] = total_budget;
        dashboard["totalSpent"] = total_spent;
        dashboard["avgRoi"] = std::round(avg_roi * 100.0) / 100.0; // 2 знака
        dashboard["teamWorkload"] = static_cast<int>(team_workload);

        // Массивы данных
        bj::array clients_arr;
        auto clients_res = txn.exec("SELECT * FROM clients ORDER BY id");
        for (const auto& row : clients_res) clients_arr.emplace_back(clientToJson(row));

        bj::array campaigns_arr;
        auto campaigns_res = txn.exec("SELECT * FROM campaigns ORDER BY id");
        for (const auto& row : campaigns_res) campaigns_arr.emplace_back(campaignToJson(row));

        bj::array tasks_arr;
        auto tasks_res = txn.exec("SELECT * FROM tasks ORDER BY id");
        for (const auto& row : tasks_res) tasks_arr.emplace_back(taskToJson(row));

        bj::array team_arr;
        auto team_res = txn.exec("SELECT * FROM team ORDER BY id");
        for (const auto& row : team_res) team_arr.emplace_back(teamMemberToJson(row));

        // Последнее обновление
        auto last_updated_res = txn.exec(R"(
            SELECT GREATEST(
                COALESCE(MAX(updated_at), '1970-01-01'::timestamp),
                COALESCE(MAX(created_at), '1970-01-01'::timestamp)
            ) AS ts
            FROM (
                SELECT updated_at, created_at FROM clients
                UNION ALL
                SELECT updated_at, created_at FROM campaigns
                UNION ALL
                SELECT updated_at, created_at FROM tasks
                UNION ALL
                SELECT updated_at, created_at FROM team
            ) AS all_updates
        )");

        std::string last_updated = last_updated_res[0]["ts"].as<std::string>();

        // Финальный ответ
        bj::object response;
        response["dashboard"] = dashboard;
        response["clients"] = std::move(clients_arr);
        response["campaigns"] = std::move(campaigns_arr);
        response["tasks"] = std::move(tasks_arr);
        response["team"] = std::move(team_arr);
        response["lastUpdated"] = last_updated;

        res.result(http::status::ok);
        res.set(http::field::content_type, "application/json");
        res.body() = bj::serialize(response);
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::internal_server_error, e.what());
    }
}

// ==================== CLIENTS ====================

void ApiProcessor::handleAddClient(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    if (req.method() != http::verb::post)
        return sendJsonError(res, http::status::method_not_allowed, "Only POST allowed");

    try {
        bj::value jv = bj::parse(req.body());
        if (!jv.is_object()) return sendJsonError(res, http::status::bad_request, "Expected JSON object");
        const bj::object& body = jv.as_object();

        std::string name = body.at("name").as_string().c_str();
        std::optional<std::string> contact = body.contains("contact") && !body.at("contact").is_null()
            ? std::make_optional(std::string(body.at("contact").as_string().c_str()))
            : std::nullopt;
        std::string status = body.contains("status") ? std::string(body.at("status").as_string().c_str()) : "prospect";

        if (name.empty()) return sendJsonError(res, http::status::bad_request, "Name is required");

        pqxx::work txn(*conn);
        pqxx::row r = txn.exec_params1(
            "INSERT INTO clients (name, contact, status) VALUES ($1, $2, $3) RETURNING *",
            name, contact, status);

        txn.commit();

        res.result(http::status::created);
        res.set(http::field::content_type, "application/json");
        res.body() = bj::serialize(clientToJson(r));
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::bad_request, std::string("Invalid data: ") + e.what());
    }
}

void ApiProcessor::handleUpdateClient(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    if (req.method() != http::verb::put)
        return sendJsonError(res, http::status::method_not_allowed, "Only PUT allowed");

    auto id_opt = parseIdFromPath(std::string(req.target()), "/api/clients/");
    if (!id_opt) return sendJsonError(res, http::status::bad_request, "Invalid client ID");
    int id = *id_opt;

    try {
        bj::value jv = bj::parse(req.body());
        if (!jv.is_object()) return sendJsonError(res, http::status::bad_request, "Expected JSON object");
        const bj::object& body = jv.as_object();

        std::string set_clause;
        std::vector<std::string> params;
        params.push_back(std::to_string(id));

        if (body.contains("name")) {
            set_clause += "name = $" + std::to_string(params.size() + 1) + ", ";
            params.push_back(std::string(body.at("name").as_string().c_str()));
        }
        if (body.contains("contact")) {
            if (body.at("contact").is_null()) {
                set_clause += "contact = NULL, ";
            }
            else {
                set_clause += "contact = $" + std::to_string(params.size() + 1) + ", ";
                params.push_back(std::string(body.at("contact").as_string().c_str()));
            }
        }
        if (body.contains("status")) {
            set_clause += "status = $" + std::to_string(params.size() + 1) + ", ";
            params.push_back(std::string(body.at("status").as_string().c_str()));
        }

        if (set_clause.empty()) return sendJsonError(res, http::status::bad_request, "No fields to update");

        set_clause.pop_back(); set_clause.pop_back(); // убираем ", "

        pqxx::work txn(*conn);
        auto result = txn.exec_params(
            "UPDATE clients SET " + set_clause + " WHERE id = $1 RETURNING *", params);

        if (result.empty()) return sendJsonError(res, http::status::not_found, "Client not found");

        txn.commit();

        res.result(http::status::ok);
        res.set(http::field::content_type, "application/json");
        res.body() = bj::serialize(clientToJson(result[0]));
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::bad_request, e.what());
    }
}

void ApiProcessor::handleDeleteClient(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    if (req.method() != http::verb::delete_)
        return sendJsonError(res, http::status::method_not_allowed, "Only DELETE allowed");

    auto id_opt = parseIdFromPath(std::string(req.target()), "/api/clients/");
    if (!id_opt) return sendJsonError(res, http::status::bad_request, "Invalid client ID");
    int id = *id_opt;

    try {
        pqxx::work txn(*conn);
        auto result = txn.exec_params("DELETE FROM clients WHERE id = $1 RETURNING id", id);

        if (result.empty()) return sendJsonError(res, http::status::not_found, "Client not found");

        txn.commit();
        res.result(http::status::ok);
        res.set(http::field::content_type, "application/json");
        bj::object obj; obj["deletedId"] = id;
        res.body() = bj::serialize(obj);
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::internal_server_error, e.what());
    }
}

// ==================== CAMPAIGNS ====================

void ApiProcessor::handleAddCampaign(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    if (req.method() != http::verb::post)
        return sendJsonError(res, http::status::method_not_allowed, "Only POST allowed");

    try {
        bj::value jv = bj::parse(req.body());
        if (!jv.is_object()) return sendJsonError(res, http::status::bad_request, "Expected JSON object");
        const bj::object& body = jv.as_object();

        int client_id = body.at("clientId").as_int64();
        std::string name = body.at("name").as_string().c_str();
        std::string status = body.contains("status") ? std::string(body.at("status").as_string().c_str()) : "planning";
        double budget = body.contains("budget") ? body.at("budget").as_double() : 0.0;

        pqxx::work txn(*conn);
        // Проверка существования клиента
        if (txn.query_value<int>("SELECT 1 FROM clients WHERE id = $1", client_id) != 1)
            return sendJsonError(res, http::status::bad_request, "Client not found");

        pqxx::row r = txn.exec_params1(
            "INSERT INTO campaigns (client_id, name, status, budget) VALUES ($1, $2, $3, $4) RETURNING *",
            client_id, name, status, budget);

        txn.commit();

        res.result(http::status::created);
        res.set(http::field::content_type, "application/json");
        res.body() = bj::serialize(campaignToJson(r));
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::bad_request, e.what());
    }
}

void ApiProcessor::handleUpdateCampaign(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    auto id_opt = parseIdFromPath(std::string(req.target()), "/api/campaigns/");
    if (!id_opt) return sendJsonError(res, http::status::bad_request, "Invalid campaign ID");
    int id = *id_opt;

    try {
        bj::value jv = bj::parse(req.body());
        if (!jv.is_object()) return sendJsonError(res, http::status::bad_request, "Expected JSON object");
        const bj::object& body = jv.as_object();

        std::string set_clause;
        std::vector<std::string> params;
        params.emplace_back(std::to_string(id));  // $1 = id

        if (body.contains("name")) {
            set_clause += "name = $" + std::to_string(params.size() + 1) + ", ";
            params.emplace_back(body.at("name").as_string().c_str());
        }
        if (body.contains("status")) {
            set_clause += "status = $" + std::to_string(params.size() + 1) + ", ";
            params.emplace_back(body.at("status").as_string().c_str());
        }
        if (body.contains("budget")) {
            set_clause += "budget = $" + std::to_string(params.size() + 1) + ", ";
            params.emplace_back(std::to_string(body.at("budget").as_double()));
        }
        if (body.contains("spent")) {
            set_clause += "spent = $" + std::to_string(params.size() + 1) + ", ";
            params.emplace_back(std::to_string(body.at("spent").as_double()));
        }
        if (body.contains("startDate")) {
            if (body.at("startDate").is_null()) {
                set_clause += "start_date = NULL, ";
            }
            else {
                set_clause += "start_date = $" + std::to_string(params.size() + 1) + ", ";
                params.emplace_back(body.at("startDate").as_string().c_str());
            }
        }
        if (body.contains("endDate")) {
            if (body.at("endDate").is_null()) {
                set_clause += "end_date = NULL, ";
            }
            else {
                set_clause += "end_date = $" + std::to_string(params.size() + 1) + ", ";
                params.emplace_back(body.at("endDate").as_string().c_str());
            }
        }
        if (body.contains("roi")) {
            if (body.at("roi").is_null()) {
                set_clause += "roi = NULL, ";
            }
            else {
                set_clause += "roi = $" + std::to_string(params.size() + 1) + ", ";
                params.emplace_back(std::to_string(body.at("roi").as_double()));
            }
        }

        if (set_clause.empty()) return sendJsonError(res, http::status::bad_request, "No fields to update");
        set_clause.pop_back(); set_clause.pop_back(); // удаляем ", "

        pqxx::work txn(*conn);
        std::string query = "UPDATE campaigns SET " + set_clause + " WHERE id = $1 RETURNING *";

        pqxx::result result;
        if (params.size() == 1) {
            result = txn.exec(query);  // только id
        }
        else {
            std::vector<pqxx::zview> zparams;
            for (size_t i = 1; i < params.size(); ++i)  // пропускаем $1 (id)
                zparams.emplace_back(params[i]);
            result = txn.exec_params(query, zparams);
        }

        if (result.empty()) return sendJsonError(res, http::status::not_found, "Campaign not found");

        txn.commit();

        res.result(http::status::ok);
        res.set(http::field::content_type, "application/json");
        res.body() = bj::serialize(campaignToJson(result[0]));
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::bad_request, e.what());
    }
}

void ApiProcessor::handleDeleteCampaign(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    auto id_opt = parseIdFromPath(std::string(req.target()), "/api/campaigns/");
    if (!id_opt) return sendJsonError(res, http::status::bad_request, "Invalid campaign ID");
    int id = *id_opt;

    try {
        pqxx::work txn(*conn);
        auto result = txn.exec_params("DELETE FROM campaigns WHERE id = $1 RETURNING id", id);

        if (result.empty()) return sendJsonError(res, http::status::not_found, "Campaign not found");

        txn.commit();
        res.result(http::status::ok);
        bj::object obj; obj["deletedId"] = id;
        res.body() = bj::serialize(obj);
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::internal_server_error, e.what());
    }
}

// ==================== TASKS ====================

void ApiProcessor::handleAddTask(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    try {
        bj::value jv = bj::parse(req.body());
        if (!jv.is_object()) return sendJsonError(res, http::status::bad_request, "Expected JSON object");
        const bj::object& body = jv.as_object();

        int campaign_id = body.at("campaignId").as_int64();
        std::optional<int> assignee_id = body.contains("assigneeId") && !body.at("assigneeId").is_null()
            ? std::make_optional(static_cast<int>(body.at("assigneeId").as_int64()))
            : std::nullopt;
        std::string title = body.at("title").as_string().c_str();
        std::optional<std::string> description = body.contains("description") && !body.at("description").is_null()
            ? std::make_optional(std::string(body.at("description").as_string().c_str()))
            : std::nullopt;
        std::string status = body.contains("status") ? std::string(body.at("status").as_string().c_str()) : "todo";
        std::optional<std::string> due_date = body.contains("dueDate") && !body.at("dueDate").is_null()
            ? std::make_optional(std::string(body.at("dueDate").as_string().c_str()))
            : std::nullopt;

        pqxx::work txn(*conn);
        if (txn.query_value<int>("SELECT 1 FROM campaigns WHERE id = $1", campaign_id) != 1)
            return sendJsonError(res, http::status::bad_request, "Campaign not found");

        pqxx::row r = txn.exec_params1(
            "INSERT INTO tasks (campaign_id, assignee_id, title, description, status, due_date) "
            "VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            campaign_id, assignee_id, title, description, status, due_date);

        txn.commit();

        res.result(http::status::created);
        res.body() = bj::serialize(taskToJson(r));
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::bad_request, e.what());
    }
}

void ApiProcessor::handleUpdateTask(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    auto id_opt = parseIdFromPath(std::string(req.target()), "/api/tasks/");
    if (!id_opt) return sendJsonError(res, http::status::bad_request, "Invalid task ID");
    int id = *id_opt;

    try {
        bj::value jv = bj::parse(req.body());
        if (!jv.is_object()) return sendJsonError(res, http::status::bad_request, "Expected JSON object");
        const bj::object& body = jv.as_object();

        std::string set_clause;
        std::vector<std::string> params;
        params.emplace_back(std::to_string(id));

        if (body.contains("title")) {
            set_clause += "title = $" + std::to_string(params.size() + 1) + ", ";
            params.emplace_back(body.at("title").as_string().c_str());
        }
        if (body.contains("description")) {
            if (body.at("description").is_null()) {
                set_clause += "description = NULL, ";
            }
            else {
                set_clause += "description = $" + std::to_string(params.size() + 1) + ", ";
                params.emplace_back(body.at("description").as_string().c_str());
            }
        }
        if (body.contains("status")) {
            set_clause += "status = $" + std::to_string(params.size() + 1) + ", ";
            params.emplace_back(body.at("status").as_string().c_str());
        }
        if (body.contains("dueDate")) {
            if (body.at("dueDate").is_null()) {
                set_clause += "due_date = NULL, ";
            }
            else {
                set_clause += "due_date = $" + std::to_string(params.size() + 1) + ", ";
                params.emplace_back(body.at("dueDate").as_string().c_str());
            }
        }
        if (body.contains("assigneeId")) {
            if (body.at("assigneeId").is_null()) {
                set_clause += "assignee_id = NULL, ";
            }
            else {
                set_clause += "assignee_id = $" + std::to_string(params.size() + 1) + ", ";
                params.emplace_back(std::to_string(body.at("assigneeId").as_int64()));
            }
        }

        if (set_clause.empty()) return sendJsonError(res, http::status::bad_request, "No fields to update");
        set_clause.pop_back(); set_clause.pop_back();

        pqxx::work txn(*conn);
        std::string query = "UPDATE tasks SET " + set_clause + " WHERE id = $1 RETURNING *";

        pqxx::result result;
        if (params.size() == 1) {
            result = txn.exec(query);
        }
        else {
            std::vector<pqxx::zview> zparams;
            for (size_t i = 1; i < params.size(); ++i)
                zparams.emplace_back(params[i]);
            result = txn.exec_params(query, zparams);
        }

        if (result.empty()) return sendJsonError(res, http::status::not_found, "Task not found");

        txn.commit();

        res.result(http::status::ok);
        res.set(http::field::content_type, "application/json");
        res.body() = bj::serialize(taskToJson(result[0]));
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::bad_request, e.what());
    }
}

void ApiProcessor::handleDeleteTask(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    auto id_opt = parseIdFromPath(std::string(req.target()), "/api/tasks/");
    if (!id_opt) return sendJsonError(res, http::status::bad_request, "Invalid task ID");
    int id = *id_opt;

    try {
        pqxx::work txn(*conn);
        auto result = txn.exec_params("DELETE FROM tasks WHERE id = $1 RETURNING id", id);

        if (result.empty()) return sendJsonError(res, http::status::not_found, "Task not found");

        txn.commit();
        res.result(http::status::ok);
        bj::object obj; obj["deletedId"] = id;
        res.body() = bj::serialize(obj);
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::internal_server_error, e.what());
    }
}

// ==================== TEAM ====================

void ApiProcessor::handleAddTeamMember(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    try {
        bj::value jv = bj::parse(req.body());
        if (!jv.is_object()) return sendJsonError(res, http::status::bad_request, "Expected JSON object");
        const bj::object& body = jv.as_object();

        std::string fullname = body.at("fullname").as_string().c_str();
        std::string role = body.at("role").as_string().c_str();
        double workload = body.contains("workload") ? body.at("workload").as_double() : 0.0;

        if (fullname.empty() || role.empty()) return sendJsonError(res, http::status::bad_request, "fullname and role required");

        pqxx::work txn(*conn);
        pqxx::row r = txn.exec_params1(
            "INSERT INTO team (fullname, role, workload) VALUES ($1, $2, $3) RETURNING *",
            fullname, role, workload);

        txn.commit();

        res.result(http::status::created);
        res.body() = bj::serialize(teamMemberToJson(r));
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::bad_request, e.what());
    }
}

void ApiProcessor::handleUpdateTeamMember(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    auto id_opt = parseIdFromPath(std::string(req.target()), "/api/team/");
    if (!id_opt) return sendJsonError(res, http::status::bad_request, "Invalid team member ID");
    int id = *id_opt;

    try {
        bj::value jv = bj::parse(req.body());
        if (!jv.is_object()) return sendJsonError(res, http::status::bad_request, "Expected JSON object");
        const bj::object& body = jv.as_object();

        std::string set_clause;
        std::vector<std::string> params{ std::to_string(id) };

        if (body.contains("fullname")) { set_clause += "fullname = $" + std::to_string(params.size() + 1) + ", "; params.push_back(body.at("fullname").as_string().c_str()); }
        if (body.contains("role")) { set_clause += "role = $" + std::to_string(params.size() + 1) + ", "; params.push_back(body.at("role").as_string().c_str()); }
        if (body.contains("workload")) { set_clause += "workload = $" + std::to_string(params.size() + 1) + ", "; params.push_back(std::to_string(body.at("workload").as_double())); }

        if (set_clause.empty()) return sendJsonError(res, http::status::bad_request, "No fields to update");

        set_clause.pop_back(); set_clause.pop_back();

        pqxx::work txn(*conn);
        auto result = txn.exec_params("UPDATE team SET " + set_clause + " WHERE id = $1 RETURNING *", params);

        if (result.empty()) return sendJsonError(res, http::status::not_found, "Team member not found");

        txn.commit();

        res.result(http::status::ok);
        res.body() = bj::serialize(teamMemberToJson(result[0]));
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::bad_request, e.what());
    }
}

void ApiProcessor::handleDeleteTeamMember(const http::request<http::string_body>& req,
    http::response<http::string_body>& res) {
    auto* conn = getConn();
    if (!conn) return sendJsonError(res, http::status::service_unavailable, "Database not ready");

    auto id_opt = parseIdFromPath(std::string(req.target()), "/api/team/");
    if (!id_opt) return sendJsonError(res, http::status::bad_request, "Invalid team member ID");
    int id = *id_opt;

    try {
        pqxx::work txn(*conn);
        auto result = txn.exec_params("DELETE FROM team WHERE id = $1 RETURNING id", id);

        if (result.empty()) return sendJsonError(res, http::status::not_found, "Team member not found");

        txn.commit();
        res.result(http::status::ok);
        bj::object obj; obj["deletedId"] = id;
        res.body() = bj::serialize(obj);
        res.prepare_payload();
    }
    catch (const std::exception& e) {
        sendJsonError(res, http::status::internal_server_error, e.what());
    }
}