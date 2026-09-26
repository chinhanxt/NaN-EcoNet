cmake_minimum_required(VERSION 3.10)
project(vrppl_loader)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Optimization flags matching documentation: -O3 -fopenmp -march=native
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -fopenmp -march=native -DNDEBUG")
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_compile_options(-Wall -Wextra)
endif()

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

list(APPEND CMAKE_PREFIX_PATH "$ENV{HOME}/.local" "$ENV{HOME}/.local/lib/x86_64-linux-gnu/cmake")
find_package(yaml-cpp REQUIRED)
find_package(OpenMP REQUIRED)
find_package(nlohmann_json 3.2.0 REQUIRED)

if(DEFINED YAML_CPP_INCLUDE_DIR)
    include_directories(${YAML_CPP_INCLUDE_DIR})
endif()

if(TARGET yaml-cpp::yaml-cpp)
    set(YAML_CPP_TARGET yaml-cpp::yaml-cpp)
else()
    set(YAML_CPP_TARGET yaml-cpp)
endif()

target_link_libraries(main ${YAML_CPP_TARGET} OpenMP::OpenMP_CXX)

target_link_libraries(test ${YAML_CPP_TARGET} OpenMP::OpenMP_CXX)