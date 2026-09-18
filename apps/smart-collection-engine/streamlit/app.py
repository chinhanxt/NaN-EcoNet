"""
VRP Visualization Streamlit App

A web interface for:
1. Uploading VRP instance files
2. Visualizing the problem (depot, customers, lockers)
3. Running PACO solvers
4. Displaying and plotting solution routes
"""

import streamlit as st
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.lines import Line2D
import numpy as np
import yaml
from pathlib import Path
import pandas as pd

from vrp_parser import parse_instance, VRPInstance, get_node_type_name, get_node_color, generate_instance_content
from solver_api_client import run_solver, solve_manual, AVAILABLE_SOLVERS, SIZE_OPTIONS, SolverResult, get_params_path


# Page configuration
st.set_page_config(
    page_title="VRP Solver",
    page_icon="🚚",
    layout="wide",
)

# Title and description
st.title("🚚 Vehicle Routing Problem Solver")
st.markdown("""
Upload a VRP instance file or create one manually, visualize the problem, and solve it using optimization algorithms.

**Supported Solvers:**
- **PACO**: Parallel Ant Colony Optimization
""")

# Sidebar for controls
st.sidebar.header("⚙️ Settings")

# Input Mode Selection
input_mode = st.sidebar.radio(
    "Input Mode",
    options=["File Upload", "Manual Input"],
    help="Choose between uploading a file or creating an instance manually"
)

# Initialize uploaded_file
uploaded_file = None

if input_mode == "File Upload":
    # File upload
    uploaded_file = st.sidebar.file_uploader(
        "Upload VRP Instance File",
        type=["txt"],
        help="Upload a VRP-PL instance file in the standard format"
    )
elif input_mode == "Manual Input":
    st.sidebar.info("Configure the instance parameters in the main area.")

st.sidebar.markdown("---")

# Solver selection
solver = st.sidebar.selectbox(
    "Select Solver",
    options=AVAILABLE_SOLVERS,
    format_func=lambda x: {"paco": "PACO (Parallel ACO)"}.get(x, x),
)

# Size selection
size = st.sidebar.selectbox(
    "Problem Size (Parameter Set)",
    options=SIZE_OPTIONS,
    help="Select parameter preset based on problem size"
)

# Configuration Mode
config_mode = st.sidebar.radio(
    "Configuration",
    options=["Default", "Manual"],
    help="Choose 'Manual' to customize solver parameters"
)

params_override = None

if config_mode == "Manual":
    st.sidebar.markdown("---")
    st.sidebar.subheader("🛠️ Manual Parameters")
    
    try:
        # Load default parameters for current solver
        params_path = get_params_path(solver)
        if params_path.exists():
            with open(params_path, 'r') as f:
                full_config = yaml.safe_load(f)
            
            # Get params for selected size
            if size in full_config:
                current_config = full_config[size]
                # Deep copy to avoid modifying original info directly (though we re-read anyway)
                import copy
                edited_config = copy.deepcopy(current_config)
                
                # We expect a 'params' key inside
                if 'params' in edited_config:
                    st.sidebar.markdown(f"**{size.capitalize()} Parameters**")
                    param_dict = edited_config['params']
                    
                    # Create widgets for each parameter
                    new_params = {}
                    for key, value in param_dict.items():
                        if isinstance(value, float):
                            new_params[key] = st.sidebar.number_input(
                                f"{key}", value=value, format="%.4f"
                            )
                        elif isinstance(value, int):
                            new_params[key] = st.sidebar.number_input(
                                f"{key}", value=value, step=1
                            )
                        else:
                            # Fallback for other types (str, bool, etc.)
                            new_params[key] = st.sidebar.text_input(f"{key}", value=str(value))
                    
                    # Update config with new params
                    edited_config['params'] = new_params
                    
                    full_config[size] = edited_config
                    params_override = full_config
                    
                else:
                    st.sidebar.warning(f"No 'params' section found for size '{size}'")
            else:
                st.sidebar.warning(f"Size '{size}' not found in parameter file")
        else:
            st.sidebar.error(f"Parameter file not found: {params_path}")
            
    except Exception as e:
        st.sidebar.error(f"Error loading parameters: {e}")

# Initialize session state
if 'instance' not in st.session_state:
    st.session_state.instance = None
if 'instance_content' not in st.session_state:
    st.session_state.instance_content = None
if 'solution' not in st.session_state:
    st.session_state.solution = None
if 'manual_data' not in st.session_state:
    st.session_state.manual_data = None


def plot_instance(instance: VRPInstance, solution: SolverResult = None) -> plt.Figure:
    """
    Create a matplotlib figure showing the VRP instance and optionally the solution routes.
    
    Args:
        instance: The parsed VRP instance
        solution: Optional solver result with routes
        
    Returns:
        matplotlib Figure object
    """
    fig, ax = plt.subplots(1, 1, figsize=(10, 10))
    
    # Plot routes if solution provided
    if solution and solution.success and solution.raw_routes:
        # Generate colors for routes
        route_colors = plt.cm.tab10(np.linspace(0, 1, len(solution.raw_routes)))
        
        all_nodes = instance.get_all_nodes()
        
        for route_idx, route in enumerate(solution.raw_routes):
            color = route_colors[route_idx]
            
            # Get coordinates for route nodes (raw_routes contains integer node IDs)
            route_x = []
            route_y = []
            for node_id in route:
                if isinstance(node_id, int) and 0 <= node_id < len(all_nodes):
                    node = all_nodes[node_id]
                    route_x.append(node.x)
                    route_y.append(node.y)
            
            # Plot route as lines
            if len(route_x) > 1:
                ax.plot(route_x, route_y, '-', color=color, linewidth=2, alpha=0.7,
                       label=f'Route {route_idx + 1}')
                
                # Add arrows to show direction
                for i in range(len(route_x) - 1):
                    dx = route_x[i+1] - route_x[i]
                    dy = route_y[i+1] - route_y[i]
                    ax.annotate('', 
                               xy=(route_x[i+1], route_y[i+1]),
                               xytext=(route_x[i], route_y[i]),
                               arrowprops=dict(arrowstyle='->', color=color, lw=1.5),
                               )
    
    # Plot depot (star marker)
    ax.scatter(instance.depot.x, instance.depot.y, 
              c=get_node_color(0), marker='*', s=400, zorder=5,
              edgecolors='black', linewidths=1.5, label='Depot')
    
    # Plot customers by type
    for ctype in [1, 2, 3]:
        customers_of_type = [c for c in instance.customers if c.node_type == ctype]
        if customers_of_type:
            xs = [c.x for c in customers_of_type]
            ys = [c.y for c in customers_of_type]
            ax.scatter(xs, ys, 
                      c=get_node_color(ctype), marker='o', s=100, zorder=4,
                      edgecolors='black', linewidths=0.5,
                      label=get_node_type_name(ctype))
            
            # Add customer labels
            for c in customers_of_type:
                ax.annotate(str(c.id), (c.x, c.y), 
                           textcoords="offset points", xytext=(5, 5),
                           fontsize=8, alpha=0.7)
    
    # Plot lockers (square markers)
    if instance.lockers:
        locker_xs = [l.x for l in instance.lockers]
        locker_ys = [l.y for l in instance.lockers]
        ax.scatter(locker_xs, locker_ys,
                  c=get_node_color(4), marker='s', s=150, zorder=4,
                  edgecolors='black', linewidths=1,
                  label='Locker')
        
        # Add locker labels
        for l in instance.lockers:
            ax.annotate(f"L{l.id}", (l.x, l.y),
                       textcoords="offset points", xytext=(5, 5),
                       fontsize=8, alpha=0.7, fontweight='bold')
    
    # Styling
    ax.set_xlabel('X Coordinate', fontsize=12)
    ax.set_ylabel('Y Coordinate', fontsize=12)
    ax.set_title('VRP Instance Visualization', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    ax.legend(loc='upper left', bbox_to_anchor=(1.02, 1), borderaxespad=0)
    
    plt.tight_layout()
    return fig


def display_instance_info(instance: VRPInstance):
    """Display instance statistics in columns."""
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Customers", instance.num_customers)
    with col2:
        st.metric("Lockers", instance.num_lockers)
    with col3:
        st.metric("Vehicles", instance.num_vehicles)
    with col4:
        st.metric("Capacity", instance.vehicle_capacity)
    
    # Customer type breakdown
    st.subheader("Customer Types")
    type_counts = {}
    for c in instance.customers:
        type_name = get_node_type_name(c.node_type)
        type_counts[type_name] = type_counts.get(type_name, 0) + 1
    
    cols = st.columns(len(type_counts))
    for i, (type_name, count) in enumerate(type_counts.items()):
        with cols[i]:
            st.metric(type_name, count)


def display_solution_info(solution: SolverResult):
    """Display solution statistics."""
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Total Distance", f"{solution.objective:.2f}")
    with col2:
        st.metric("Vehicles Used", solution.vehicles)
    with col3:
        st.metric("Runtime", f"{solution.runtime:.2f}s")
    
    # Display routes
    st.subheader("📋 Routes")
    for i, route in enumerate(solution.routes):
        route_str = " → ".join(map(str, route))
        st.text(f"Route {i+1}: {route_str}")


# Main content area
if input_mode == "Manual Input":
    st.header("📝 Manual Instance Configuration")
    
    col1, col2 = st.columns(2)
    with col1:
        num_vehicles = st.number_input("Number of Vehicles", min_value=1, value=5)
    with col2:
        vehicle_capacity = st.number_input("Vehicle Capacity", min_value=1, value=100)
    
    st.subheader("Depot Configuration")
    d_col1, d_col2, d_col3, d_col4 = st.columns(4)
    with d_col1:
        depot_x = st.number_input("Depot X", value=50.0)
    with d_col2:
        depot_y = st.number_input("Depot Y", value=50.0)
    with d_col3:
        depot_start = st.number_input("Depot Start Time", value=0.0)
    with d_col4:
        depot_end = st.number_input("Depot End Time", value=1000.0)
        
    st.subheader("Customers")
    # Default customer data
    if 'manual_customers' not in st.session_state:
        st.session_state.manual_customers = pd.DataFrame({
            "x": [20.0, 80.0],
            "y": [20.0, 80.0],
            "demand": [10, 15],
            "earliest": [0.0, 0.0],
            "latest": [1000.0, 1000.0],
            "service_time": [10.0, 10.0],
            "type": ["Home", "Flexible"]
        })

    edited_customers = st.data_editor(
        st.session_state.manual_customers,
        column_config={
            "type": st.column_config.SelectboxColumn(
                "Type",
                options=["Home", "Locker", "Flexible"],
                required=True
            )
        },
        num_rows="dynamic",
        key="customer_editor"
    )
    
    st.subheader("Lockers")
    if 'manual_lockers' not in st.session_state:
        st.session_state.manual_lockers = pd.DataFrame({
            "x": [50.0],
            "y": [50.0],
            "earliest": [0.0],
            "latest": [1000.0],
            "service_time": [0.0]
        })
        
    edited_lockers = st.data_editor(
        st.session_state.manual_lockers,
        num_rows="dynamic",
        key="locker_editor"
    )

    if st.button("Generate & Load Instance", type="primary"):
        # Logic to convert dataframes to string format
        try:
             # Prepare data for generator
             depot_data = {
                 'x': depot_x, 'y': depot_y, 
                 'earliest': depot_start, 'latest': depot_end
             }
             
             type_map = {"Home": 1, "Locker": 2, "Flexible": 3}
             
             customers_list = []
             for _, row in edited_customers.iterrows():
                 c = row.to_dict()
                 c['type'] = type_map.get(c['type'], 1)
                 # Ensure defaults for required fields if missing
                 c['service_time'] = c.get('service_time', 10.0)
                 c['demand'] = c.get('demand', 0)
                 c['earliest'] = c.get('earliest', 0.0)
                 c['latest'] = c.get('latest', 1000.0)
                 customers_list.append(c)
                 
             lockers_list = []
             for _, row in edited_lockers.iterrows():
                 l = row.to_dict()
                 l['service_time'] = l.get('service_time', 0.0)
                 l['earliest'] = l.get('earliest', 0.0)
                 l['latest'] = l.get('latest', 1000.0)
                 lockers_list.append(l)

             content = generate_instance_content(
                 num_vehicles=num_vehicles,
                 vehicle_capacity=vehicle_capacity,
                 depot=depot_data,
                 customers=customers_list,
                 lockers=lockers_list
             )
             
             instance = parse_instance(content)
             st.session_state.instance = instance
             st.session_state.instance_content = content
             st.session_state.solution = None

             # Store structured data for API payload
             st.session_state.manual_data = {
                 "num_vehicles": num_vehicles,
                 "vehicle_capacity": vehicle_capacity,
                 "depot": depot_data,
                 "customers": customers_list,
                 "lockers": lockers_list
             }

             st.success("✅ Generated Instance Successfully!")
             st.rerun()
             
        except Exception as e:
            st.error(f"Error generating instance: {e}")

elif uploaded_file is not None:
    # Read and parse the file
    try:
        content = uploaded_file.read().decode('utf-8')
        instance = parse_instance(content)
        st.session_state.instance = instance
        st.session_state.instance_content = content
        st.session_state.solution = None  # Reset solution when new file uploaded
        
        st.success(f"✅ Loaded instance: {uploaded_file.name}")
        
    except Exception as e:
        st.error(f"❌ Error parsing file: {e}")
        st.session_state.instance = None
        st.session_state.instance_content = None

# Display instance if loaded
if st.session_state.instance is not None:
    instance = st.session_state.instance
    
    # Instance info
    st.header("📊 Instance Information")
    display_instance_info(instance)
    
    # Solve button
    st.header("🔧 Solve")
    
    if st.button("🚀 Run Solver", type="primary"):
        with st.spinner(f"Running {solver.upper()} solver..."):
            if input_mode == "Manual Input":
                if st.session_state.manual_data:
                    st.info("Using Manual Input Endpoint") # Optional debug
                    result = solve_manual(
                        st.session_state.manual_data,
                        solver=solver,
                        size=size,
                        params_override=params_override,
                    )
                else:
                    st.warning("⚠️ Please click 'Generate & Load Instance' above to prepare the data.")
                    result = SolverResult(
                        objective=0, vehicles=0, runtime=0, routes=[],
                        success=False, 
                        error_message="Manual data not generated. Click 'Generate & Load Instance' first."
                    )
            else:
                # st.info("Using File Upload Endpoint") # Optional debug
                result = run_solver(
                    st.session_state.instance_content,
                    solver=solver,
                    size=size,
                    params_override=params_override,
                )
            
            st.session_state.solution = result
        
        if result.success:
            st.success("✅ Solution found!")
        else:
            st.error(f"❌ Solver failed: {result.error_message}")
    
    # Display solution if available
    if st.session_state.solution is not None and st.session_state.solution.success:
        st.header("📈 Solution")
        display_solution_info(st.session_state.solution)
    
    # Visualization
    st.header("🗺️ Visualization")
    
    fig = plot_instance(instance, st.session_state.solution)
    st.pyplot(fig)
    plt.close(fig)

else:
    # Show instructions when no file is loaded
    st.info("👆 Upload a VRP instance file using the sidebar to get started.")
    
    st.markdown("""
    ### Instance File Format
    
    The VRP-PL instance file should have the following structure:
    
    ```
    <num_customers> <num_lockers>
    <num_vehicles> <vehicle_capacity>
    <demand_1>
    <demand_2>
    ...
    <demand_n>
    <x> <y> <earliest> <latest> <service_time> <type>  # depot (type=0)
    <x> <y> <earliest> <latest> <service_time> <type>  # customer 1
    ...
    <x> <y> <earliest> <latest> <service_time> <type>  # locker 1 (type=4)
    <locker_assignment_row_1>
    <locker_assignment_row_2>
    ...
    ```
    
    **Customer Types:**
    - Type 1: Home delivery only
    - Type 2: Locker delivery only
    - Type 3: Flexible (home or locker)
    - Type 4: Locker node
    """)


# Footer
st.sidebar.markdown("---")
st.sidebar.markdown("**VRP-PL Solver** v1.0")
st.sidebar.markdown("Using PACO algorithm")