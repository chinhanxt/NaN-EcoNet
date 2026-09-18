"""
Dedicated Map-Only UI for VRP Solver.
Runs on port 8502 - Pure, full-screen map visualization.
"""

from __future__ import annotations
from pathlib import Path
from typing import Dict, Optional

import streamlit as st
from streamlit_folium import st_folium
import streamlit.components.v1 as components

from vrp_parser import parse_instance, VRPInstance
from solver_api_client import run_solver, SolverResult
from map_visualizer import create_vrp_map, ANCHOR_CITIES


# Configure Streamlit page for maximum map area
st.set_page_config(
    page_title="VRP Map Viewer",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Custom CSS: Remove padding and chrome so the screen is purely the map
st.markdown("""
<style>
    /* Maximize viewing space */
    .block-container {
        padding-top: 0.4rem !important;
        padding-bottom: 0rem !important;
        padding-left: 0.6rem !important;
        padding-right: 0.6rem !important;
        max-width: 100% !important;
    }
    header, footer, #MainMenu {
        display: none !important;
        visibility: hidden !important;
    }
    .stDeployButton {
        display: none !important;
    }
    div[data-testid="stToolbar"] {
        display: none !important;
    }
    /* Compact controls */
    div[data-testid="stHorizontalBlock"] {
        align-items: center;
        background: #ffffff;
        padding: 4px 12px;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        margin-bottom: 6px;
    }
    .stSelectbox label, .stCheckbox label {
        font-size: 12px !important;
        font-weight: 600 !important;
        margin-bottom: 0px !important;
    }
</style>
""", unsafe_allow_html=True)


def load_all_benchmark_files() -> Dict[str, Path]:
    """Find all benchmark files available."""
    roots = [
        Path(__file__).parent.parent / "src" / "data",
        Path("/app/src/data"),
        Path("src/data"),
    ]
    data_dir = None
    for r in roots:
        if r.exists() and r.is_dir():
            data_dir = r
            break

    files_dict: Dict[str, Path] = {}
    if data_dir:
        for p in sorted(data_dir.rglob("*.txt")):
            if p.name != "readme.txt":
                # Create readable label like: [25] C101_co_25.txt
                category = p.parent.name
                files_dict[f"[{category}] {p.name}"] = p
    return files_dict


benchmark_files = load_all_benchmark_files()

# Session State
if "map_instance" not in st.session_state:
    st.session_state.map_instance = None
if "map_solution" not in st.session_state:
    st.session_state.map_solution = None
if "last_loaded_file" not in st.session_state:
    st.session_state.last_loaded_file = None

# Top minimalist toolbar
col_file, col_city, col_scale, col_solve, col_info = st.columns([3, 2, 2, 2, 3])

with col_file:
    file_options = list(benchmark_files.keys())
    default_idx = 0
    # Try to pick C101_co_25.txt as default
    for idx, opt in enumerate(file_options):
        if "C101_co_25" in opt:
            default_idx = idx
            break
    
    selected_option = st.selectbox(
        "📂 Dữ liệu benchmark",
        options=file_options,
        index=default_idx if file_options else 0,
        label_visibility="collapsed",
    )

with col_city:
    selected_city = st.selectbox(
        "📍 Vị trí bản đồ",
        options=list(ANCHOR_CITIES.keys()),
        index=0,
        label_visibility="collapsed",
    )

with col_scale:
    scale_m = st.slider(
        "Tỉ lệ (m)",
        min_value=30.0,
        max_value=300.0,
        value=100.0,
        step=10.0,
        help="Khoảng cách thực tế (mét) mỗi đơn vị tọa độ",
    )

with col_solve:
    show_routes = st.checkbox("🚚 Hiện tuyến xe", value=True)

# Load data if changed
if selected_option and selected_option in benchmark_files:
    file_path = benchmark_files[selected_option]
    if st.session_state.last_loaded_file != str(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                raw_content = f.read()
            instance = parse_instance(raw_content)
            st.session_state.map_instance = instance
            st.session_state.map_content = raw_content
            st.session_state.map_solution = None
            st.session_state.last_loaded_file = str(file_path)
        except Exception as e:
            st.error(f"Lỗi đọc file: {e}")

@st.cache_data(show_spinner=False)
def get_cached_solution(content: str, solver: str, size: str) -> SolverResult:
    return run_solver(content, solver=solver, size=size)


# Solve if routes enabled
solution = None
if show_routes and st.session_state.map_instance:
    category = "small"
    if "50" in selected_option:
        category = "medium"
    elif "100" in selected_option:
        category = "large"
    
    solution = get_cached_solution(st.session_state.map_content, "paco", category)

with col_info:
    if solution and solution.success:
        st.markdown(f"**🛣️ {solution.objective:.1f} km** | **{solution.vehicles} xe** | ⏱️ {solution.runtime:.1f}s")
    elif st.session_state.map_instance:
        inst = st.session_state.map_instance
        st.markdown(f"**👥 {inst.num_customers} khách** | **🗄️ {inst.num_lockers} lockers**")

# Render Map (Only the Map fills the screen!)
if st.session_state.map_instance:
    folium_map = create_vrp_map(
        instance=st.session_state.map_instance,
        solution=solution if show_routes else None,
        anchor_name=selected_city,
        scale_meters=scale_m,
        animate_routes=True,
        show_stop_numbers=True,
    )

    map_html = folium_map._repr_html_()
    components.html(map_html, height=850)
else:
    st.info("Vui lòng chọn một file dữ liệu benchmark để xem bản đồ.")
