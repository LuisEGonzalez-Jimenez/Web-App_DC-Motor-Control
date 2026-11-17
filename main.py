import numpy as np
import control as ct
import matplotlib.pyplot as plt
from scipy.signal import savgol_filter
import json
from pyscript import web, when, window
from pyscript import document
import js
import asyncio
import plotly.graph_objects as go

"""
from simple_pid import PID

this function has a bit of issues. it doesnt accept N as a parameter, so we cant add filters.
in case someone is inherting this code. just to let it be know that we explored the code and there are 2 options. either you copy the code and modify the library as it doesnt
seem entierly that complex. or you use another library for PID

just remeber taht when you add a library also aadd it to the pyscript.json.
"""
from simple_pid import PID

STATE_STEP = 0
STATE_SINE = 1
STATE_PID = 2
SIM = 3

CONTINUOUS = 0
DISCRETE = 1


async def main():
    #lets wait until the promes gets returned.
    promise = js.jsReadyPromise
    await promise


    #remove loading screen
    loading_screen = web.page["#loading_screen_id"]
    loading_screen.classes.add("display_hidden")
    

#identifying motor parameters.
def estimate_motor_params(t, v, i, omega, Kt_equals_Kb=True):
    """
    Estimate DC motor parameters from time-series data.
    
    Parameters
    ----------
    t     : (N,) time vector [s]
    v     : (N,) armature voltage [V]
    i     : (N,) armature current [A]
    omega : (N,) angular velocity [rad/s]
    
    Returns
    -------
    dict with Ra, La, Kb, Kt, Jm, Bm
    """
    
    # we cna probably remove this sanity check as im pretty sure there is no scenario in which we create a array without numpy for this
    # sanity check---------
    t = np.asarray(t)
    v = np.asarray(v)
    i = np.asarray(i)
    omega = np.asarray(omega)

    dt = np.mean(np.diff(t))

    # --- numerical derivatives (Savitzky-Golay is robust to noise) ---
    # window must be odd and <= len(t)
    w = min(31, len(t) - (1 - len(t) % 2))
    if w % 2 == 0: w -= 1
    if w < 5:
        di_dt   = np.gradient(i, t)
        domega_dt = np.gradient(omega, t)
    else:
        di_dt     = savgol_filter(i,     w, 3, deriv=1, delta=dt)
        domega_dt = savgol_filter(omega, w, 3, deriv=1, delta=dt)

    # =========================================================
    # 1) Electrical equation:  v = Ra·i + La·di/dt + Kb·ω
    #    Regress v on [i, di/dt, ω]  ->  [Ra, La, Kb]
    # =========================================================
    Phi_e = np.column_stack([i, di_dt, omega])   # (N,3)
    theta_e, *_ = np.linalg.lstsq(Phi_e, v, rcond=None)
    Ra, La, Kb = theta_e

    # =========================================================
    # 2) Mechanical equation:  Kt·i = Jm·dω/dt + Bm·ω
    #    Regress i on [dω/dt, ω]  ->  [Jm/Kt, Bm/Kt]
    # =========================================================
    Phi_m = np.column_stack([domega_dt, omega])  # (N,2)
    theta_m, *_ = np.linalg.lstsq(Phi_m, i, rcond=None)
    Jm_over_Kt, Bm_over_Kt = theta_m

    # =========================================================
    # 3) Recover Jm, Bm
    # =========================================================
    if Kt_equals_Kb:
        Kt = Kb
        Jm = Jm_over_Kt * Kt
        Bm = Bm_over_Kt * Kt
    else:
        # Not identifiable without a torque sensor — fall back to Kt = Kb
        raise ValueError("Separate Kt and Kb are unidentifiable from v,i,ω alone.")

    return {
        "Ra": Ra, "La": La,
        "Kb": Kb, "Kt": Kt,
        "Jm": Jm, "Bm": Bm,
    }









def build_motor():
    #create our simulated motor.
    #this needs more logic, you change the value and nothing changes till you force a save
    #if we are in the sim page, we get the values from the input boxes
    #we currently dont need this unless we have the real motor, and this function will never see that becuase we are building the simulated motor
    # ui_vcc = float(web.page["UI_vcc"].value)
    

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
    #current consideration
    #teacher ads -1/Jm instead of a 0. this is the extra input area
    B = np.array([[1 / La], [0]], dtype=float)
    #out put
    C = np.array([[1, 0],
                  [0, 1]], dtype=float)
    D = np.array([[0], [0]], dtype=float)
    return A, B, C, D

#run simulations for step and sine depending on whether it is continuous or discrete.
def run_simulation(u, x0, how_long, n_samples=1000):
    A, B, C, D = build_motor()
    motor = ct.ss(A, B, C, D)


    time_array = np.linspace(0, how_long, n_samples)
    
    t_out, output = ct.forced_response(motor, T=time_array, U=u, X0=x0)
    current = output[0]
    omega   = output[1]


    #we are returning now current and omega instead of only output.
    #aditionally we are changing time array for t_out, which should probably be the same
    #before:  return time_array2, output, u
    return t_out, current, omega, u

#this is only for pid, because pid isnt supposed to have predict motor parameters.
# set point is the desired speed in radians
def run_pid_simulation(setpoint, x0, how_long, n_samples=1000, Kp=1.0, Ki=0.1, Kd=0.01, dt=None, condis=CONTINUOUS):
    A, B, C, D = build_motor()
    motor = ct.ss(A, B, C, D)
    
    if dt is None:
        dt = how_long / n_samples
    
    if(condis == DISCRETE):
        #this migth expect a matrix of 1000 and in discrete the nimber of samples is dif
        n_samples =  int(how_long / dt)
        print("how_long")
        print(how_long)
        print("dt")
        print(dt)
        print("n_samples")
        print(n_samples)

    # Initialize PID
    pid = PID(Kp, Ki, Kd, setpoint=setpoint, sample_time=dt)
    print("we changed this conditions tato delete this later")
    pid.output_limits = (-3000, 3000)  # adjust to your motor voltage limits
    
    # State and storage
    x = x0.copy()
    
    y = C @ x
    current = float(y[0])
    omega = float(y[1])

    current_values = []
    omega_values = []
    u_values = []
    error_values = []
    t_values = [0.0] #this is probably initial value that we need
    
    for _ in range(n_samples):
        y = C @ x
        current = float(y[0])
        omega = float(y[1])
        
        current_values.append(current)
        omega_values.append(omega)
        error = setpoint - omega
        error_values.append(error)
        
        u_k = pid(omega, dt=dt) #this supposibly makes it take longer but it should be accurate every time
        # u_k = pid(omega) #this had so many different outputs depending on the time almost random.
        u_values.append(u_k)
        
        x = x + dt * (A @ x + B.flatten() * u_k)
        t_values.append(len(t_values) * dt)
        
    return np.array(t_values), np.array(current_values), np.array(omega_values), np.array(u_values), np.array(error_values)


#making plots ----------------------------------
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
    iframe.style.height = "95%"
    iframe.style.border = "none"

    iframe.srcdoc = fig.to_html(include_plotlyjs="cdn", full_html=True)
    container.innerHTML = ""
    container.appendChild(iframe)
#this is tecnically not implemented, ive only added it so when im programming at 3am and i wanna do a quick change in colors i just change these 2 functions to 
#not oblitarate my eyes with how white the page is.
def plot_graphs_dark(time, output, output_label, title, graph_id):
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=time,
        y=output,
        mode="lines",
        name="ω(t)",
        line=dict(color="#60A5FA", width=2)
    ))

    fig.update_layout(
        title=title,
        xaxis_title="Time [s]",
        yaxis_title=output_label,
        template="plotly_dark",
        paper_bgcolor="#0A0A0A",
        plot_bgcolor="#0A0A0A",
        font=dict(color="#F5F5F5"),
    )

    container = document.getElementById(graph_id)
    iframe = document.createElement("iframe")
    iframe.style.width = "100%"
    iframe.style.height = "95%"
    iframe.style.border = "none"
    iframe.style.backgroundColor = "#0A0A0A"

    iframe.srcdoc = fig.to_html(
        include_plotlyjs="cdn",
        full_html=True,
        config={"responsive": True}
    )

    container.innerHTML = ""
    container.appendChild(iframe)

#just a call to plot everything easier
def plot_everything(time, omega, voltage, current, error):

    plot_graphs(time, omega, "Angular velocity [rad/s]", "DC Motor Speed Response" , "plot_area_1")

    plot_graphs(time, voltage, output_label="Voltage [V]", title="Armature Voltage", graph_id="plot_area_2",)
    
    plot_graphs(time, current, "Current", "Current response over time", "plot_area_3")

    if(error):
        plot_graphs(time, error, "Error", "Error over time", "plot_area_4")
    else:
        document.getElementById("plot_area_4").innerHTML = ""


#-----------------------------------------------

#in these functions we just make the array of voltages that will be fed to the simulation
#intuitively there is no PID, because that one responds to the conditions to which the motor is at. thus we cant pre make the voltage that will be inputed to the motor func
# creating voltages array functions -------------------------------------
def make_step(t, amplitude: float, t0: float = 0.0, offset: float = 0.0):
    
    """
    Returns u(t):
        offset                          for t < t0
        offset + amplitude              for t >= t0
    """
    return np.where(t >= t0, amplitude + offset, offset).astype(float)

def make_sine(t, A: float, omega: float, phi: float = 0.0, delta: float = 0.0):
    """
    Returns a continuous sine function u(t):

        u(t) = A * sin(omega * t + phi) + delta

    Parameters
    ----------
    t : array-like
        Time (or independent variable) values.
    A : float
        Amplitude of the sine wave.
    omega : float
        Angular frequency (rad/s). Period T = 2*pi / omega.
    phi : float, optional
        Phase angle (radians), default 0.0.
    delta : float, optional
        Vertical offset (DC component), default 0.0.

    Returns
    -------
    numpy.ndarray
        Sine wave evaluated at t.
    """
    
    t = np.asarray(t, dtype=float)
    return A * np.sin(omega * t + phi) + delta

def make_sine_discrete(n, A: float, omega: float, phi: float = 0.0, delta: float = 0.0):
    n = np.asarray(n, dtype=float)   # cast to float so sin() works
    return A * np.sin(omega * n + phi) + delta
#-----------------------------------------------------------------------



def calculate(value, u, t, samples: int = 1000):
    x0 = [0, 0]

    # Simulate
    # def run_simulation(u, vcc: float, x0, time series, n_samples: int = 1000):
    time, current, omega, voltage = run_simulation(u, x0, t, samples)
    print("we gonna call plt everything with a false error PLEASE")
    plot_everything(time, omega, voltage, current, False)

    #now actually predicting what the variables of the motor look like
    #estimate_motor_params(t, v, i, omega, Kt_equals_Kb=True)
    dictionary = estimate_motor_params(time, voltage, current, omega, True)

    #how do we send dictionary window variable so that it jsut pastes it in the js
    window.identify_results = json.dumps(dictionary)


#this contains the whole logic when one plays simulate. it basically calls upon everything above
#it decides which function was clicked, selects the apropriate information and plots it.
async def on_play_simulation_button_py(event=None):
    await js.jsReadyPromise  
    

    #check what option is selected
    selected = int(js.sb_state)
    condis = int(js.sb_condis)

    #Ra = float(js.simulate_motor.armature_resistance) (reference of how to write)
    # amp = float(js.step.amp)

    print(selected)
    
    #assume time input is 5
    time_amount = float(web.page["UI_time"].value)
    time_samples = 1000 #this is default

    print("time amount:")
    print(time_amount)

    STATE_STEP = 0
    STATE_SINE = 1
    STATE_PID = 2
    IDEN = 3
    


    if selected == STATE_STEP:
        #these arent loaded so:
        #Ra = float(js.simulate_motor.armature_resistance) (reference of how to write)
        amp = float(web.page["UI_amp"].value)
        print(amp)
        if not amp:
            print("no amp received")
            amp = 0

        it = float(web.page["UI_it"].value)
        print(it)
        if not it:
            print("no inital time received")
            it = 0

        offset = float(web.page["UI_offset"].value)
        if not offset:
            print("no offset received")
            offset = 0

        #time change later
        time_array = np.linspace(0, time_amount, 1000)

        #u stands for voltage array
        #def make_step(t, amplitude: float, t0: float = 0.0, offset: float = 0.0):
        u = make_step(time_array, amp, it, offset)
        
    if selected == STATE_SINE and condis == CONTINUOUS:

        amp = float(web.page["UI_amp"].value)
        if not amp:
            print("no amp given")
            amp = 0
        freq = float(web.page["UI_freq"].value)
        if not freq:
            print("no freq given")
            freq = 0
        phase_angle = float(web.page["UI_phase_angle"].value)
        if not phase_angle:
            print("no phase_angle given")
            phase_angle = 0
        offset = float(web.page["UI_offset"].value)
        if not offset:
            print("no offset given")
            offset = 0
        # period = web.page["UI_period"].value
        # if not period:
        #     print("no period given")
        #     period = 0

        #time change later
        time_array = np.linspace(0, time_amount, 1000)

        #u stands for voltage array
        #def make_sine(t, A: float, omega: float, phi: float = 0.0, delta: float = 0.0):
        u = make_sine(time_array, amp, freq, phase_angle, offset)
    
    if selected == STATE_SINE and condis == DISCRETE:

        amp = float(web.page["UI_amp"].value)
        if not amp:
            print("no amp given")
            amp = 0
        freq = float(web.page["UI_freq"].value)
        if not freq:
            print("no freq given")
            freq = 0
        phase_angle = float(web.page["UI_phase_angle"].value)
        if not phase_angle:
            print("no phase_angle given")
            phase_angle = 0
        offset = float(web.page["UI_offset"].value)
        if not offset:
            print("no offset given")
            offset = 0
        period = float(web.page["UI_period"].value)
        if not period:
            print("no period given")
            period = 1

        time_samples = int(time_amount / period)
        #time change later
        time_array = np.linspace(0, time_amount, time_samples)

        #u stands for voltage array
        #we gotta design time_array which means cmaking the number of samples

        #def make_sine_discrete(n, A: float, omega: float, phi: float = 0.0, delta: float = 0.0):
        u = make_sine_discrete(time_array, amp, freq, phase_angle, offset)

    if selected == STATE_PID and condis == CONTINUOUS:

        simulation_time = float(web.page["UI_time"].value)
        if not simulation_time:
            simulation_time = 0

        gains_kp = float(web.page["UI_gainskp"].value)
        if not gains_kp:
            gains_kp = 0

        gains_ki = float(web.page["UI_gainski"].value)
        if not gains_ki:
            gains_ki = 0

        gains_kd = float(web.page["UI_gainskd"].value)
        if not gains_kd:
            gains_kd = 0

        target_speed = float(web.page["UI_ts"].value)
        if not target_speed:
            target_speed = 0
        

        #def run_pid_simulation(setpoint, x0, how_long, n_samples=1000, Kp=1.0, Ki=0.1, Kd=0.01, dt=None):
        time, current, omega, voltage, error = run_pid_simulation(target_speed, np.array([0.0, 0.0]), simulation_time, n_samples=1000, Kp=gains_kp, Ki=gains_ki, Kd=gains_kd, condis=condis)
        #UI_gainskp

        #return np.array(t_values), np.array(current_values), np.array(omega_values), np.array(u_values)
        # time, current, omega, voltage = run_simulation(u, x0, t, samples)
        plot_everything(time, omega, voltage, current, error)

    if selected == STATE_PID and condis == DISCRETE:

        simulation_time = float(web.page["UI_time"].value)
        if not simulation_time:
            simulation_time = 0

        gains_kp = float(web.page["UI_gainskp"].value)
        if not gains_kp:
            gains_kp = 0

        gains_ki = float(web.page["UI_gainski"].value)
        if not gains_ki:
            gains_ki = 0

        gains_kd = float(web.page["UI_gainskd"].value)
        if not gains_kd:
            gains_kd = 0

        target_speed = float(web.page["UI_ts"].value)
        if not target_speed:
            target_speed = 10
        
        sample_time = float(web.page["UI_sample_time"].value)
        print("sample_time")
        print(sample_time)
        if not sample_time:
            sample_time = 10


        #def run_pid_simulation(setpoint, x0, how_long, n_samples=1000, Kp=1.0, Ki=0.1, Kd=0.01, dt=None):
        time, current, omega, voltage, error = run_pid_simulation(target_speed, np.array([0.0, 0.0]), simulation_time, n_samples=1000, Kp=gains_kp, Ki=gains_ki, Kd=gains_kd,dt=sample_time , condis=condis)
        #UI_gainskp

        #return np.array(t_values), np.array(current_values), np.array(omega_values), np.array(u_values)
        # time, current, omega, voltage = run_simulation(u, x0, t, samples)
        plot_everything(time, omega, voltage, current, error)




    if selected == STATE_PID:
        return 0
    

    """
    based on the previous outputs, a csv containing the data of how the motor behaved
    with this data we pass it to a function that should output the motors configuration.
    """
    
    calculate(selected, u, time_amount, time_samples)

    #if its step 
#we assing the function to a button in the js. this is because when python is not going to "know" when we delete the button and it exists again to re assign it.
#thus we just store a variable with the pointer to this function so that it can call it.
window.on_play_simulation_button_js = on_play_simulation_button_py






#------------------------------------------------------
#this section will now focus on control for the actual chip. how we connect to it. 
# As well as communication with it and interactions with how we communicate.





#------------------------------------------------------

#ill later move them above. as it is proper code, but im still wondering as to whether there is going to be multiple files
#but im worried taht i might need to call upon modifications on the plot functions. as im not sure how theyll interact to live data.



# Schedule the async function to run
asyncio.ensure_future(main())

main()