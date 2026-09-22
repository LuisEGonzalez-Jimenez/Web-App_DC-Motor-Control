import numpy as np
import control as ct
import matplotlib.pyplot as plt

from pyscript import web, when
from pyscript import document
import js
import asyncio
import plotly.graph_objects as go

STEP = 0
SINE = 1
PID = 2
SIM = 3

CONTINUOUS = 0
DISCRETE = 1


async def main():
    #lets wait until the promes gets returned.
    promise = js.jsReadyPromise
    await promise


def build_motor():
    #create our simulated motor.
    #this needs more logic, you change the value and nothing changes till you force a save
    #if we are in the sim page, we get the values from the input boxes
    float(web.page["UI_vcc"].value)
    if(js.sb_state == SIM):
        Ra = float(web.page["UI_armature_resistance"].value)
        La = float(web.page["UI_armature_inductance"].value)
        Kb = float(web.page["UI_back_electromotive_force_constant"].value)
        Kt = float(web.page["UI_torque_constant"].value)
        Jm = float(web.page["UI_motor_rotor_inertia"].value)
        Bm = float(web.page["UI_viscous_friction_coefficient"].value)
    else:
        Ra = float(js.simulate_motor.armature_resistance)
        La = float(js.simulate_motor.armature_inductance)
        Kb = float(js.simulate_motor.back_electromotive_force_constant)
        Kt = float(js.simulate_motor.torque_constant)
        Jm = float(js.simulate_motor.motor_rotor_inertia)
        Bm = float(js.simulate_motor.viscous_friction_coefficient)
    
    
    A = np.array([
        [-Ra / La, -Kb / La],
        [ Kt / Jm, -Bm / Jm],
    ], dtype=float)
    B = np.array([[1 / La], [0]], dtype=float)
    C = np.array([[0, 1]], dtype=float)
    D = np.array([[0]], dtype=float)
    print("Built motor")
    return A, B, C, D

#u used to be the space state for current, thus it stayed the same. 
# but know i believe we might adapt it to be the variabel which changes
def run_simulation(u, vcc: float, x0, how_long, n_samples: int = 1000):
    A, B, C, D = build_motor()
    motor = ct.ss(A, B, C, D)

    
    t = np.linspace(0, how_long, n_samples)
    
    
    u = np.ones_like(t) * vcc

    
    time, output = ct.forced_response(motor, T=t, U=u, X0=x0)
    return time, output, u

# plot_graphs(time, output, "DC Motor Speed Response" ,"Angular velocity [rad/s]", plot_area_1)
def plot_graphs(time, output, output_label, title, graph_id):
    #plot motor speed
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=time, y=output, mode="lines", name="ω(t)"))
    fig.update_layout(
        title=title,
        xaxis_title="Time [s]",
        yaxis_title=output_label,
    )

    container = document.getElementById(graph_id)
    iframe = document.createElement("iframe")
    iframe.style.width = "100%"
    iframe.style.height = "100%"
    iframe.style.border = "none"

    iframe.srcdoc = fig.to_html(include_plotlyjs="cdn", full_html=True)
    container.innerHTML = ""
    container.appendChild(iframe)

def make_step(t, amplitude: float, t0: float = 0.0, offset: float = 0.0):
    """
    Returns u(t):
        offset                          for t < t0
        offset + amplitude              for t >= t0
    """
    return np.where(t >= t0, amplitude + offset, offset).astype(float)










@when("click", "#b_start")
async def on_start(event):
    await js.jsReadyPromise  
    print("clicked button")
    
    vcc = float(web.page["UI_vcc"].value)   
    # Initial conditions:
    # current = 0 A
    # speed = 0 rad/s
    x0 = [0, 0]

    # Simulate
    time, output, voltage = run_simulation(0, vcc, x0, 5, 1000)

    #plot
    plot_graphs(time, output, "Angular velocity [rad/s]", "DC Motor Speed Response" , "plot_area_1")
    plot_graphs(time, voltage, output_label="Voltage [V]", title="Armature Voltage", graph_id="plot_area_2",)

# Schedule the async function to run
asyncio.ensure_future(main())

    


