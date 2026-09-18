cmake_minimum_required(VERSION 3.10)
project(vrppl_loader)

set(CMAKE_CXX_STANDARD 17)

# Gather source files from new structure
# Use CONFIGURE_DEPENDS so CMake regenerates when new source files are added (e.g., ALNS.cpp)
file(GLOB CORE_SRC CONFIGURE_DEPENDS src/core/*.cpp)
file(GLOB SOLVER_SRC CONFIGURE_DEPENDS src/solvers/*.cpp)

add_executable(main
    src/main.cpp
    src/utils.cpp
    ${CORE_SRC}
    ${SOLVER_SRC}
)

add_executable(test
    src/test.cpp
    src/utils.cpp
    ${CORE_SRC}
    ${SOLVER_SRC}
)

find_package(yaml-cpp REQUIRED)
find_package(OpenMP REQUIRED)
find_package(nlohmann_json 3.2.0 REQUIRED)

target_link_libraries(main yaml-cpp OpenMP::OpenMP_CXX)

target_link_libraries(test yaml-cpp OpenMP::OpenMP_CXX)