#include "SolverFactory.h"

std::unique_ptr<Solver> SolverFactory::create(const std::string& solver_name) {
    auto& registry = get_registry();
    auto it = registry.find(solver_name);
    if (it != registry.end()) {
        return it->second();
    }
    return nullptr;
}

void SolverFactory::register_solver(const std::string& solver_name, SolverCreator creator) {
    get_registry()[solver_name] = creator;
}

std::unordered_map<std::string, SolverFactory::SolverCreator>& SolverFactory::get_registry() {
    static std::unordered_map<std::string, SolverCreator> registry;
    return registry;
}
