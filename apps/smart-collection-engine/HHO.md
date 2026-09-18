Procedure: HHO_for_VRP(Customers N, Vehicles K)
    // Stage 1: Global Search to Minimize Number of Vehicles
    Initialize population of N hawks (each hawk is a routing strategy σ: set of routes serving all customers)
    For each hawk σ:
        Ensure capacity constraint: Load per vehicle ≤ ceil(N / K)
        Compute fitness f(σ) = |σ| + (sum c(σ_i) for i in 1 to |σ|) / |σ|  // Eq. (14)
    
    While not termination (e.g., t < T/2 or no improvement):
        // HHO Exploration Phase (Global Search)
        For each hawk i:
            If random p >= |E| (escaping energy, |E| = 2 * (1 - t/T)):  // High energy: exploration
                Update position (route σ) randomly or based on other hawks' positions
            Else:  // Low energy: transition to exploitation
                Select surprise pounce strategy (soft/hard besiege) based on prey (rabbit/best solution) escape probability r
                If r >= 0.5 and |E| >= 0.5:  // Soft besiege
                    Update σ towards best σ_rabbit with levy flight for diversity
                Else If r >= 0.5 and |E| < 0.5:  // Hard besimùa xuân đầu tiên văn caoege
                    Directly update towards best σ_rabbit
                // Other variants: soft/hard besiege with progressive dives (adapt routes by swapping/inserting customers)
        Evaluate new fitness for updated σ, replace if better and feasible (capacity, all customers served)
        Update best global σ_best (minimum vehicles and cost)
    
    // Stage 2: Local Search to Minimize Travel Cost
    Set initial population to refined solutions from Stage 1 (use σ_best as "rabbit")
    Reset iteration t for local focus
    While not termination (e.g., t < T/2 or no improvement):
        // HHO Exploitation Phase (Local Search)
        For each hawk i:
            Focus on local updates: Adjust routes in σ (e.g., swap customers between routes, shorten paths)
            Use hard/soft besiege to converge on best local σ_rabbit (minimize sum c(σ_i), keep |σ| fixed)
            Apply levy flight for small perturbations (e.g., 2-opt or insert moves in routes)
        Evaluate new fitness (now prioritize total travel cost sum c(σ_i), subject to capacity)
        Replace if better and feasible
    
    Return best routing strategy σ_best (routes, vehicle assignments, total cost)