import numpy as np
import control as ct
import matplotlib.pyplot as plt

from pyscript import web, when, window
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
    
    Ra = float(web.page["UI_armature_resistance"].value)
    La = float(web.page["UI_armature_inductance"].value)
    Kb = float(web.page["UI_back_electromotive_force_constant"].value)
    Kt = float(web.page["UI_torque_constant"].value)
    Jm = float(web.page["UI_motor_rotor_inertia"].value)
    Bm = float(web.page["UI_viscous_friction_coefficient"].value)

    
    A = np.array([
        [-Ra / La, -Kb / La],
        [ Kt / Jm, -Bm / Jm],
    ], dtype=float)
    B = np.array([[1 / La], [0]], dtype=float)
    C = np.array([[0, 1]], dtype=float)
    D = np.array([[0]], dtype=float)
    return A, B, C, D

#u used to be the space state for current, thus it stayed the same. 
# but know i believe we might adapt it to be the variabel which changes
def run_simulation(u, x0, how_long, n_samples: int = 1000):
    A, B, C, D = build_motor()
    motor = ct.ss(A, B, C, D)

    
    time_array = np.linspace(0, how_long, n_samples)
    
    
    # u = np.ones_like(t) * 121

    
    time_array2, output = ct.forced_response(motor, T=time_array, U=u, X0=x0)
    return time_array2, output, u

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





#i need a function that isnt assigned or async just in case
def calculate(value, u, t):
    if value == "simulate":
        print("simulating")
        u = np.full(1000, 12)
        voltage_backup = u
    # elif value == "Step":
        

    
    # Initial conditions:
    # current = 0 A
    # speed = 0 rad/s
    x0 = [0, 0]

    # Simulate
    # def run_simulation(u, vcc: float, x0, time series, n_samples: int = 1000):
    time, output, voltage = run_simulation(u, x0, t, 1000)

    

    #plot
    plot_graphs(time, output, "Angular velocity [rad/s]", "DC Motor Speed Response" , "plot_area_1")
    if value == "simulate":
        plot_graphs(time, voltage_backup, output_label="Voltage [V]", title="Armature Voltage", graph_id="plot_area_2",)
    else:

        plot_graphs(time, voltage, output_label="Voltage [V]", title="Armature Voltage", graph_id="plot_area_2",)
    
    #now actually predicting what the variables of the motor look like

    
@when("click", "#b_start")
async def on_start(event):
    await js.jsReadyPromise  
    print("clicked start button")
    #this is super hard coded TODO: fix this
    calculate("simulate", 12, 5) 





# submit identification only exists when we click window so
# @when("click", ".UI_submit_identification")

#step simulate and more prob
async def on_submit_identification(event=None):
    await js.jsReadyPromise  
    
    #check what option is selected
    selected = document.querySelector('input[name="method_identification"]:checked')
    
    #if selected does exist
    if not selected:
        return 0
    
    #assume time input is 5
    time_amount = 5

    value = selected.value
    if value == "Step":

        #these arent loaded so:
        #Ra = float(js.simulate_motor.armature_resistance) (reference of how to write)
        amp = float(js.step.amp)
        it = float(js.step.it)
        offset = float(js.step.offset)

        if not amp:
            print("no amp received")
            amp = 0
        if not it:
            print("no inital time received")
            it = 0
        if not offset:
            print("no offset received")
            offset = 0
        #time change later
        time_array = np.linspace(0, time_amount, 1000)

        #u stands for voltage array
        #def make_step(t, amplitude: float, t0: float = 0.0, offset: float = 0.0):
        u = make_step(time_array, amp, it, offset)
        


    if value == "Sine":
        return 0
    if value == "PID":
        return 0
    

    """
    based on the previous outputs, a csv containing the data of how the motor behaved
    with this data we pass it to a function that should output the motors configuration.
    """
    
    calculate(value, u, time_amount )

    #if its step 

window.handleIdentification = on_submit_identification

@when("keydown", ".enter_exectute_graphs")
def on_key(event):
    if event.key == "Enter":
        event.preventDefault()
        calculate("simulate", 12, 5)





# Schedule the async function to run
# this might be useless as we dont really use the main 
asyncio.ensure_future(main())

    



