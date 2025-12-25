cmake_minimum_required(VERSION 3.15)  # Здесь главное изменение
project(KursachMari-Tigrex-ServerBase LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ------------------- Зависимости -------------------
find_package(Boost REQUIRED COMPONENTS asio beast json program_options)
find_package(libpqxx CONFIG REQUIRED)
find_package(PostgreSQL REQUIRED)

# ------------------- Автоматический сбор источников -------------------
file(GLOB SOURCES
    "${CMAKE_CURRENT_SOURCE_DIR}/*.cpp"                  # файлы в корне
    "${CMAKE_CURRENT_SOURCE_DIR}/*/*.cpp"                # один уровень (architecture/*.cpp и т.д.)
    "${CMAKE_CURRENT_SOURCE_DIR}/*/*/*.cpp"              # два уровня (если появятся подподпапки)
    "${CMAKE_CURRENT_SOURCE_DIR}/*/*/*/*.cpp"            # три уровня — на будущее
)

# Основной исполняемый файл
add_executable(${PROJECT_NAME}
    KursachMari-Tigrex-ServerBase.cpp    # main явно
    ${SOURCES}                   # все остальные .cpp автоматически
)

# ------------------- Линковка -------------------
target_link_libraries(${PROJECT_NAME} PRIVATE
    Boost::asio
    Boost::beast
    Boost::json
    Boost::program_options
    libpqxx::pqxx
    PostgreSQL::PostgreSQL
    
)

# ------------------- Include -------------------
target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_include_directories(${PROJECT_NAME} SYSTEM PRIVATE 
    $<TARGET_PROPERTY:libpqxx::pqxx,INTERFACE_INCLUDE_DIRECTORIES>
)

target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/architecture
    ${CMAKE_CURRENT_SOURCE_DIR}/database
    ${CMAKE_CURRENT_SOURCE_DIR}/server
    ${CMAKE_CURRENT_SOURCE_DIR}/utils
    ${CMAKE_CURRENT_SOURCE_DIR}/abstract-front
)

# ------------------- Копирование папки static рядом с бинарником -------------------
# Путь к папке static в исходниках (относительно верхнего CMakeLists.txt)
set(STATIC_SOURCE_DIR "${CMAKE_SOURCE_DIR}/static")

# Путь, куда копировать (рядом с исполняемым файлом в build-директории)
set(STATIC_DEST_DIR "$<TARGET_FILE_DIR:${PROJECT_NAME}>/static")

# Добавляем кастомную команду, которая копирует всю папку рекурсивно
add_custom_command(
    TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${STATIC_SOURCE_DIR}
        ${STATIC_DEST_DIR}
    COMMENT "Moving dir static to binary out."
)

# Предупреждения (опционально)
if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE /W4 /permissive-)
else()
    target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -pedantic)
endif()