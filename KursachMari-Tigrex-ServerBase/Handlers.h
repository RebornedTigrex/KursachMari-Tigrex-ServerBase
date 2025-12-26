#pragma once

#include "RequestHandler.h"
#include "ApiProcessor.h"

#include <string>
#include <boost/beast/http.hpp>

namespace http = boost::beast::http;

void printConnectionInfo(tcp::socket& socket) {
    try {
        tcp::endpoint remote_ep = socket.remote_endpoint();
        boost::asio::ip::address client_address = remote_ep.address();
        unsigned short client_port = remote_ep.port();

        std::cout << "Client connected from: "
            << client_address.to_string()
            << ":" << client_port << std::endl;
    }
    catch (const boost::system::system_error& e) {
        std::cerr << "Error getting connection info: " << e.what() << std::endl;
    }
}

void CreateAPIHandlers(RequestHandler* module, ApiProcessor* apiProcessor) {
    // Основной эндпоинт — возвращает все данные для фронтенда
    module->addRouteHandler("/api/all-data", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() != http::verb::get) {
            res.result(http::status::method_not_allowed);
            res.set(http::field::content_type, "text/plain");
            res.body() = "Method Not Allowed. Use GET.";
            return;
        }
        apiProcessor->handleGetAllData(req, res);
        });

    // ==================== CLIENTS ====================
    module->addRouteHandler("/api/clients", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::post) {
            apiProcessor->handleAddClient(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });

    module->addDynamicRouteHandler("/api/clients/\\d+(?:/)?", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::put) {
            apiProcessor->handleUpdateClient(req, res);
        }
        else if (req.method() == http::verb::delete_) {
            apiProcessor->handleDeleteClient(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });

    // ==================== CAMPAIGNS ====================
    module->addRouteHandler("/api/campaigns", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::post) {
            apiProcessor->handleAddCampaign(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });

    module->addDynamicRouteHandler("/api/campaigns/\\d+(?:/)?", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::put) {
            apiProcessor->handleUpdateCampaign(req, res);
        }
        else if (req.method() == http::verb::delete_) {
            apiProcessor->handleDeleteCampaign(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });

    // ==================== TASKS ====================
    module->addRouteHandler("/api/tasks", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::post) {
            apiProcessor->handleAddTask(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });

    module->addDynamicRouteHandler("/api/tasks/\\d+(?:/)?", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::put) {
            apiProcessor->handleUpdateTask(req, res);
        }
        else if (req.method() == http::verb::delete_) {
            apiProcessor->handleDeleteTask(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });

    // ==================== TEAM ====================
    module->addRouteHandler("/api/team", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::post) {
            apiProcessor->handleAddTeamMember(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });

    module->addDynamicRouteHandler("/api/team/\\d+(?:/)?", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::put) {
            apiProcessor->handleUpdateTeamMember(req, res);
        }
        else if (req.method() == http::verb::delete_) {
            apiProcessor->handleDeleteTeamMember(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });
}

void CreateNewHandlers(RequestHandler* module, std::string staticFolder) {
    // Тестовый маршрут
    module->addRouteHandler("/test", [](const sRequest& req, sResponce& res) {
        if (req.method() != http::verb::get) {
            res.result(http::status::method_not_allowed);
            res.set(http::field::content_type, "text/plain");
            res.body() = "Method Not Allowed. Use GET.";
            return;
        }
        res.set(http::field::content_type, "text/plain");
        res.body() = "Advertising Agency MVP Backend is running!\nРусский язык тоже поддерживается.";
        res.result(http::status::ok);
        });

    module->addRouteHandler("/*", [](const sRequest& req, sResponce& res) {
        });
}