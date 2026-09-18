#pragma once

#include "../solvers/Solver.h"
#include <memory>
#include <string>
#include <functional>
#include <unordered_map>

class SolverFactory {
public:
    using SolverCreator = std::function<std::unique_ptr<Solver>()>;

    static std::unique_ptr<Solver> create(const std::string& solver_name);
    static void register_solver(const std::string& solver_name, SolverCreator creator);

private:
    static std::unordered_map<std::string, SolverCreator>& get_registry();
};

// A helper class to automatically register solvers
template<class T>
class SolverRegistrar {
public:
    SolverRegistrar(const std::string& solver_name) {
        SolverFactory::register_solver(solver_name, []() {
            return std::make_unique<T>();
        });
    }
};
