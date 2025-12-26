#pragma once

#include <boost/json.hpp>
#include <pqxx/pqxx>
#include <string>
#include <optional>

#include "macros.h"  // Для http::request, http::response и т.д.

class DatabaseModule;

namespace bj = boost::json;
namespace http = boost::beast::http;

class ApiProcessor {
private:
    DatabaseModule* db_module_;

    pqxx::connection* getConn();

    void sendJsonError(http::response<http::string_body>& res,
        http::status status,
        const std::string& message);

    // Конвертеры в JSON для фронтенда
    bj::object clientToJson(const pqxx::row& row);
    bj::object campaignToJson(const pqxx::row& row);
    bj::object taskToJson(const pqxx::row& row);
    bj::object teamMemberToJson(const pqxx::row& row);

    std::optional<std::string> getQueryParam(const std::string& target, const std::string& param_name);
    std::optional<int> parseIdFromPath(const std::string& path, const std::string& prefix);

public:
    explicit ApiProcessor(DatabaseModule* db_module);

    // Основной эндпоинт, который использует фронтенд
    void handleGetAllData(const http::request<http::string_body>& req,
        http::response<http::string_body>& res);

    // Заготовки для CRUD (реализуем на следующем шаге)
    void handleAddClient(const http::request<http::string_body>& req, http::response<http::string_body>& res);
    void handleUpdateClient(const http::request<http::string_body>& req, http::response<http::string_body>& res);
    void handleDeleteClient(const http::request<http::string_body>& req, http::response<http::string_body>& res);

    void handleAddCampaign(const http::request<http::string_body>& req, http::response<http::string_body>& res);
    void handleUpdateCampaign(const http::request<http::string_body>& req, http::response<http::string_body>& res);
    void handleDeleteCampaign(const http::request<http::string_body>& req, http::response<http::string_body>& res);

    void handleAddTask(const http::request<http::string_body>& req, http::response<http::string_body>& res);
    void handleUpdateTask(const http::request<http::string_body>& req, http::response<http::string_body>& res);
    void handleDeleteTask(const http::request<http::string_body>& req, http::response<http::string_body>& res);

    void handleAddTeamMember(const http::request<http::string_body>& req, http::response<http::string_body>& res);
    void handleUpdateTeamMember(const http::request<http::string_body>& req, http::response<http::string_body>& res);
    void handleDeleteTeamMember(const http::request<http::string_body>& req, http::response<http::string_body>& res);
};