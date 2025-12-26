#pragma once

#include "RequestHandler.h"
#include "ApiProcessor.h"

#include <string>

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
    // Основной эндпоинт для всех данных — как ожидает фронт
    module->addRouteHandler("/api/all-data", [apiProcessor](const sRequest& req, sResponce& res) {
        apiProcessor->handleGetAllData(req, res);
        });

    // Список сотрудников (можно оставить как есть, но лучше сделать отдельный обработчик позже)
    module->addRouteHandler("/api/employees", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::post) {
            apiProcessor->handleAddEmployee(req, res);
        }
        else if (req.method() == http::verb::get) {
            apiProcessor->handleGetAllData(req, res); // временно ок — фронт пока не использует отдельно
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });

    module->addDynamicRouteHandler("/api/employees/\\d+(?:/)?", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::put) {
            apiProcessor->handleUpdateEmployee(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });
    module->addDynamicRouteHandler("/api/hours/\\d+(?:/)?", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::post) {
            apiProcessor->handleAddHours(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });
    module->addDynamicRouteHandler("/api/employees/\\d+/penalties(?:/)?", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::post) {
            apiProcessor->handleAddPenalty(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });
    module->addDynamicRouteHandler("/api/employees/\\d+/bonuses(?:/)?", [apiProcessor](const sRequest& req, sResponce& res) {
        if (req.method() == http::verb::post) {
            apiProcessor->handleAddBonus(req, res);
        }
        else {
            res.result(http::status::method_not_allowed);
        }
        });
}

void CreateNewHandlers(RequestHandler* module, std::string staticFolder) {
    module->addRouteHandler("/test", [](const sRequest& req, sResponce& res) {
        if (req.method() != http::verb::get) {
            res.result(http::status::method_not_allowed);
            res.set(http::field::content_type, "text/plain");
            res.body() = "Method Not Allowed. Use GET.";
            return;
        }
        res.set(http::field::content_type, "text/plain");
        res.body() = "RequestHandler Module Scaling Test.\nAlso checking support for the Russian language.";
        res.result(http::status::ok);
        });

    module->addRouteHandler("/*", [](const sRequest& req, sResponce& res) {});
}