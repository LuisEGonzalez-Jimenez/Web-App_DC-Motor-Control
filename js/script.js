//sidebar Functionality ---------------------------
const INITIATE = -1;
const STEP = 0;
const SINE = 1;
const PID = 2;


const CONTINUOUS = 0;
const DISCRETE = 1;

const SPEED_AND_VOLTAGE = 0;
const CURRENT_AND_ERROR = 1;

const SAME_AS_LAST = -1;
const SIMULATED_CONTROL = 0;
const REAL_TIME_CONTROL = 1;
const SYSTEM_IDENTIFICATION = 2;

//changes_caused_by_sri_buttons
const CCBSB_EXEC_SRI = 0;
const CCBSB_EXEC_CHANGE_TO_SECTION = 1;


window.sb_state = INITIATE; 
window.sb_condis = CONTINUOUS;
window.sim_area = SIMULATED_CONTROL;
graphs_state = SPEED_AND_VOLTAGE;

window.simulate_time = 10;
window.real_vcc = 12;

window.step = {
    amp: 0,
    it: 0,
    offset: 0,
    dutycycle: 0,
    sign: 0
};

window.sine_con = {
    amp: 0,
    freq: 0,
    phase_angle: 0,
    offset: 0
};

window.sine_dis = {
    period: 0
};

window.pid_con = {
    ts: 0,
    kp: 0,
    ki: 0,
    kd: 0
};
window.pid_dis = {
    sample_time: 0.001
};

// Create a promise and expose it on the window object
window.jsReadyPromise = new Promise((resolve) => {
    // Store the resolve function so you can call it later
    window.resolveJsReady = resolve;
});


//Ra = 1.19; La = 0.013; Kb = 0.78; Kt = 0.6; Jm = 0.8; Bm = 0.1;

//this is no longer in use
window.simulate_motor = {
    armature_resistance: 1.19,
    armature_inductance: 0.013,
    back_electromotive_force_constant: 0.78,
    torque_constant: 0.6,
    motor_rotor_inertia: 0.8,
    viscous_friction_coefficient: 0.1 
};



let SliderDutyCycleHtml = `
    <div class="sidebar_basic_elements">
        <form action="/communicationScript.py">
            <label class="descriptor" for="DutyCyle">Duty Cycle: </label>
            <div>
                
                <input type="number" step="0.01" name="DutyCyle" id="UI_dutycycle" value="100" style="width: 7em;">
            </div>
        </form>
        
    </div>
    <div class="sidebar_basic_elements">
        <input type="range" id="SliderDutyCycle" min="1" max="100" value="50">
    </div>
    `;
let ConDisHtml = `
    <div class="sidebar_basic_elements condis" style="justify-content: center;">
        <label>
            <input type="radio" name="signalType" value="continuous" checked id="ui_sg_con">
            Continuous
        </label>

        <label>
            <input type="radio" name="signalType" value="discrete"  id="ui_sg_dis">
            Discrete 
        </label>
    </div>
    `;
let ConDisHtml_dis = `
    <div class="sidebar_basic_elements condis" style="justify-content: center;">
        <label>
            <input type="radio" name="signalType" value="continuous" id="ui_sg_con">
            Continuous
        </label>

        <label>
            <input type="radio" name="signalType" value="discrete" checked id="ui_sg_dis">
            Discrete 
        </label>
    </div>
    `;

let dictionaryFormulas = {};
dictionaryFormulas["step"] = `
        <math>
            <mi>V</mi>
            <mo>(</mo><mi>t</mi><mo>)</mo>
            <mo>=</mo>
            <mi>A</mi>
            <mi>&mu;</mi>
            <mo>(</mo>
            <mi>t</mi>
            <mo>-</mo>
            <msub><mi>t</mi><mn>0</mn></msub>
            <mo>)</mo>
            <mo>+</mo>
            <mi>&Delta;</mi>
        </math>
    `;
dictionaryFormulas["sine"] = `
        <math>
            <mi>V</mi>
            <mo>(</mo><mi>t</mi><mo>)</mo>
            <mo>=</mo>
            <mi>A</mi>
            <mi>sin</mi>
            <mo>(</mo>
                <mi>&omega;</mi>
                <mi>t</mi>
                <mo>+</mo>
                <mi>&phi;</mi>
            <mo>)</mo>
            <mo>+</mo>
            <mi>&Delta;</mi>
        </math>
    `;
dictionaryFormulas["sine_dis"] = `
        <math>
            <msub><mi>V</mi><mi>K</mi></msub>
            <mo>(</mo><mi>t</mi><mo>)</mo>
            <mo>=</mo>
            <mi>A</mi>
            <mi>sin</mi>
            <mo>(</mo>
                <mi>&omega;</mi>
                <mi>t</mi>
                <mo>+</mo>
                <mi>&phi;</mi>
            <mo>)</mo>
            <mo>+</mo>
            <mi>&Delta;</mi>
            
            <mspace width="44px"/>
            <mi>t</mi>
            <mo>=</mo>
            <mi>k</mi>
            <mi>T</mi>
        </math>
    `;
dictionaryFormulas["pid"] = `
        <math>
            <mi>V</mi>
            <mo>(</mo><mi>t</mi><mo>)</mo>
            <mo>=</mo>
            <msub><mi>V</mi><mi>P</mi></msub><mo>(</mo><mi>t</mi><mo>)</mo>
            <mo>+</mo>
            <msub><mi>V</mi><mi>i</mi></msub><mo>(</mo><mi>t</mi><mo>)</mo>
            <mo>+</mo>
            <msub><mi>V</mi><mi>D</mi></msub><mo>(</mo><mi>t</mi><mo>)</mo>
        </math>
    `;
//not done
dictionaryFormulas["pid_dis"] = `
        <math>
            <msub><mi>V</mi><mi>k</mi></msub>
            <mo>=</mo>
            <msub>
                <mi>V</mi>
                <mrow>
                    <mi>P</mi>
                    <mi>,</mi>
                    <mi>k</mi>
                <mrow>
            </msub>
            
            <mo>+</mo>
            <msub>
                <mi>V</mi>
                <mrow>
                    <mi>i</mi>
                    <mi>,</mi>
                    <mi>k</mi>
                <mrow>
            </msub>
            
            <mo>+</mo>
            <msub>
                <mi>V</mi>
                <mrow>
                    <mi>D</mi>
                    <mi>,</mi>
                    <mi>k</mi>
                <mrow>
            </msub>
            
        </math>
    `;
dictionaryFormulas["error_singal"] = `
        <math>
            <mtable>
                <mtr>
                    <mtd>
                    Error Signal:
                    </mtd>
                    <mtd>
                        <mi>e</mi>
                        <mo>(</mo><mi>t</mi><mo>)</mo>
                        <mo>=</mo>
                        <msub><mi>&omega;</mi><mi>d</mi></msub><mo>(</mo><mi>t</mi><mo>)</mo>
                        <mo>-</mo>
                        <mi>&omega;</mi><mo>(</mo><mi>t</mi><mo>)</mo>
                    </mtd>
                </mtr>
            </mtable>
        </math>
    `;
dictionaryFormulas["error_singal_dis"] = `
    <math>
        <mtable>
            <mtr>
                <mtd>
                    Error Signal:
                </mtd>
                <mtd style="padding-left:20px;">
                    <msub>
                        <mi>e</mi>
                        <mi>k</mi>
                    </msub>

                    <mo>=</mo>
                    <msub>
                        <mi>&omega;</mi>
                        <mrow>
                            <mi>d</mi>
                            <mi>,</mi>
                            <mi>k</mi>
                        </mrow>
                    </msub>

                    <mo>-</mo>
                    <msub>
                        <mi>&omega;</mi>
                        <mi>k</mi>
                    </msub>
                </mtd>
            </mtr>
        </mtable>
    </math>
    `;
dictionaryFormulas["sample_time"] = `
        <math>
            <mtable>
                <mtr>
                    <mtd>
                        Sample Time:<mspace width="10px"/>
                    
                    </mtd>
                    <mtd>
                        <mi>T</mi><mspace width="10px"/>0.005
                    </mtd>
                </mtr>
            </mtable>
        </math>
    `;
dictionaryFormulas["proportional_term"] = `
        <math>
            <mtable>
                <mtr>
                    <mtd>
                    Proportional Term:
                    </mtd>
                    <mtd>
                        <msub><mi>V</mi><mi>p</mi></msub><mo>(</mo><mi>t</mi><mo>)</mo>
                        <mo>=</mo>
                        <msub><mi>K</mi><mi>p</mi></msub><mi>e</mi><mo>(</mo><mi>t</mi><mo>)</mo>
                    </mtd>
                </mtr>
            </mtable>
        </math>
    `;

/*behavior i dont understand and will explain some of the code
    for some reason, adding a single parenthesis ads like 5 px of left padding to mtd
    additionally adding another parenthesis does increase thies left padding to 10 px.
    havinf more closed parenthesis doesnt seem to affect anything else

        thus discrete formulas that have no parenthesis need a left padding between the 2 mtd columns
*/
dictionaryFormulas["proportional_term_dis"] = `
        <math>
            <mtable>
                <mtr>
                    <mtd>
                    Proportional Term:
                    </mtd>
                    <mtd  style="padding-left:12px";>
                        <msub><mi>V</mi><mrow><mi>p</mi><mi>,</mi><mi>k</mi></mrow></msub>
                        <mo>=</mo>
                        <msub><mi>K</mi><mi>p</mi></msub>
                        <msub><mi>e</mi><mi>k</mi></msub>
                    </mtd>
                </mtr>
            </mtable>
        </math>
    `;
dictionaryFormulas["integral_term"] = `
        <math>
            <mtable>
                <mtr>
                    <mtd>
                    Integral Term:
                    </mtd>
                    <mtd>
                        <msub><mi>V</mi><mi>i</mi></msub>
                        <mo>(</mo><mi>t</mi><mo>)</mo>
                        <mo>=</mo>
                        <msub><mi>K</mi><mi>i</mi></msub>
                        

                        <msubsup>
                        <mo>&int;</mo>
                        <mrow>
                                <mi>t</mi>
                        </mrow>
                        <mrow>
                            <mn>0</mn>
                        </mrow>
                        </msubsup>

                        <mi>e</mi>
                        <mo>(</mo><mi>t</mi><mo>)</mo>
                        <mi>d</mi>
                        <mi>t</mi>


	

                    </mtd>
                </mtr>
            </mtable>
        </math>
    `;
dictionaryFormulas["integral_term_dis"] = `
        <math>
            <mtable>
                <mtr>
                    <mtd>
                    Integral Term:
                    </mtd>
                    <mtd style="padding-left:12px";>
                        
                        <msub><mi>V</mi><mrow><mi>i</mi><mi>,</mi><mi>k</mi></mrow></msub>
                        <mo>=</mo>
                        <msub><mi>K</mi><mi>i</mi></msub>
                        <mi>T</mi>
                        <msub> 
                            <mi>e</mi>
                            <mrow>
                                <mi>k</mi>
                                <mo>-</mo>
                                <mn>1</mn>
                            </mrow>
                        </msub>
                        <mo>+</mo>
                        <msub> 
                            <mi>V</mi>
                            <mrow>
                                <mi>i</mi>
                                <mi>,</mi>
                                <mi>k</mi>
                                <mo>-</mo>
                                <mn>1</mn>
                            </mrow>
                        </msub>
                        

                        

	

                    </mtd>
                </mtr>
            </mtable>
        </math>

    `;
dictionaryFormulas["derivative_term"] = `
    <math>
        <mtable>
            <mtr>
                <mtd>
                Derivative Term:
                </mtd>
                <mtd>
                    <msub><mi>V</mi><mi>D</mi></msub>
                    <mo>(</mo><mi>t</mi><mo>)</mo>
                    <mo>=</mo>
                    <msub><mi>K</mi><mi>D</mi></msub>
                    
                    <mfrac>
                    <mrow>
                        <mi>d</mi>
                        <mi>e</mi>
                        <mo>(</mo><mi>t</mi><mo>)</mo>
                    </mrow>
                    <mrow>
                        <mi>d</mi>
                        <mi>t</mi>
                    </mrow>
                    </mfrac>
                    



                </mtd>
            </mtr>
        </mtable>
    </math>
    `;
dictionaryFormulas["derivative_term_dis"] = `
    <math>
        <mtable>
            <mtr>
                <mtd>
                Derative Term:
                </mtd>
                <mtd>
                    <msub><mi>V</mi><mrow><mi>D</mi><mi>,</mi><mi>k</mi></mrow></msub>
                    <mo>=</mo>
                    
                    <mfrac>
                        <msub><mi>K</mi><mi>D</mi></msub>
                        <mi>T</mi>
                    </mfrac>
                        
                    <mo>(</mo>
                        <msub><mi>e</mi><mi>k</mi></msub>
                        <mo>-</mo>
                        <msub><mi>e</mi><mrow><mi>k</mi><mo>-</mo><mn>1</mn></mrow></msub>
                    <mo>)</mo>
                    



                </mtd>
            </mtr>
        </mtable>
    </math>
    `;


//declaring units of measure. cause dom prob shoudnt be used for this
let dictionaryUnitsOfMeasure = {};
dictionaryUnitsOfMeasure["amp"] = `
    <math><mi>A</mi></math>
`;
dictionaryUnitsOfMeasure["timezero"] = `
    <math><msub><mi>t</mi><mn>0</mn></msub></math>
`;
dictionaryUnitsOfMeasure["delta"] = `
    <math><mi>&Delta;</mi></math>
`;
dictionaryUnitsOfMeasure["omega"] = `
    <math><mi>&omega;</mi></math>
`;
dictionaryUnitsOfMeasure["phi"] = `
    <math><mi>&phi;</mi></math>
`;
dictionaryUnitsOfMeasure["period"] = `
    <math>T</math>
`;
dictionaryUnitsOfMeasure["none"] = `
    <math></math>
`;
dictionaryUnitsOfMeasure["ts"] = `
    <math><msub><mi>&omega;</mi><mi>d</mi></msub></math>  
`;
dictionaryUnitsOfMeasure["ts_pid"] = `
    <math>
    <msub>
    <mi>&omega;</mi>
    <mrow>
        <mi>d</mi>
        <mi>,</mi>
        <mi>k</mi>
    </mrow>
    </msub></math>  
`;
dictionaryUnitsOfMeasure["gains_kp"] = `
    <math><msub><mi>K</mi><mi>p</mi></msub><mspace width="0.5px"/></math>
    
`;
dictionaryUnitsOfMeasure["gains_ki"] = `
    <math><msub><mi>K</mi><mi>i</mi></msub><mspace width="4px"/></math>
    
`;
dictionaryUnitsOfMeasure["gains_kd"] = `
    <math><msub><mi>K</mi><mi>D</mi></msub></math>
    
`;
dictionaryUnitsOfMeasure["sample_time"] = `
    <math><mi>T</mi></math>
`;


dictionaryUnitsOfMeasure["armature_resistance"] = `
    <math><msub><mi>R</mi><mi>a</mi></msub></math>
    
`;
dictionaryUnitsOfMeasure["armature_inductance"] = `
    <math><msub><mi>L</mi><mi>a</mi></msub></math>
    
`;
dictionaryUnitsOfMeasure["back_electromotive_force_constant"] = `
    <math><msub><mi>K</mi><mi>b</mi></msub></math>
    
`;
dictionaryUnitsOfMeasure["torque_constant"] = `
    <math><msub><mi>K</mi><mi>t</mi></msub></math>
    
`;
dictionaryUnitsOfMeasure["motor_rotor_inertia"] = `
    <math><msub><mi>J</mi><mi>m</mi></msub></math>
    
`;
dictionaryUnitsOfMeasure["viscous_friction_coefficient"] = `
    <math><msub><mi>B</mi><mi>m</mi></msub></math>
    
`;


/* icons svg*/
let icons = {};
icons["play"] = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:20px;"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M187.2 100.9C174.8 94.1 159.8 94.4 147.6 101.6C135.4 108.8 128 121.9 128 136L128 504C128 518.1 135.5 531.2 147.6 538.4C159.7 545.6 174.8 545.9 187.2 539.1L523.2 355.1C536 348.1 544 334.6 544 320C544 305.4 536 291.9 523.2 284.9L187.2 100.9z"/></svg>
`;
icons["stop"] = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:19px; padding-bottom:0.5px;"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M160 96L480 96C515.3 96 544 124.7 544 160L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96z"/></svg>
`;
icons["save"] = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:20px;"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 237.3C544 220.3 537.3 204 525.3 192L448 114.7C436 102.7 419.7 96 402.7 96L160 96zM192 192C192 174.3 206.3 160 224 160L384 160C401.7 160 416 174.3 416 192L416 256C416 273.7 401.7 288 384 288L224 288C206.3 288 192 273.7 192 256L192 192zM320 352C355.3 352 384 380.7 384 416C384 451.3 355.3 480 320 480C284.7 480 256 451.3 256 416C256 380.7 284.7 352 320 352z"/></svg>
`;
icons["load"] = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:20px;"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M192 64C156.7 64 128 92.7 128 128L128 368L310.1 368L279.1 337C269.7 327.6 269.7 312.4 279.1 303.1C288.5 293.8 303.7 293.7 313 303.1L385 375.1C394.4 384.5 394.4 399.7 385 409L313 481C303.6 490.4 288.4 490.4 279.1 481C269.8 471.6 269.7 456.4 279.1 447.1L310.1 416.1L128 416.1L128 512.1C128 547.4 156.7 576.1 192 576.1L448 576.1C483.3 576.1 512 547.4 512 512.1L512 234.6C512 217.6 505.3 201.3 493.3 189.3L386.7 82.7C374.7 70.7 358.5 64 341.5 64L192 64zM453.5 240L360 240C346.7 240 336 229.3 336 216L336 122.5L453.5 240z"/></svg>
`;
icons["circle"] = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width:16px; margin-right:7px;"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.-->
    <path 
        fill="red" 
        stroke="#222222"
        stroke-width="40"

    
    d="M64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320z"/></svg>
`;




/*
---------------------------------------------------------------
everything above was definitions and static htmls taht we have to add

everything below is the functions that we define.
---------------------------------------------------------------
*/






/*---------------------------------------------------------------
these 6 functions save the data of the input boxes when one exits them.
they probably could be refactor into a single function called save all data. 
but this works
---------------------------------------------------------------*/
function save_step_data(){
    window.step["amp"] = document.getElementById("UI_amp").value;
    window.step["it"] = document.getElementById("UI_it").value;
    window.step["offset"] = document.getElementById("UI_offset").value;

    //these have yet to be utilized but im doing it in advance
    window.step["dutycycle"] = document.getElementById("UI_dutycycle").value;
    window.step["sign"] = document.getElementById("UI_sign").value;

    save_sim_area_data();

}
function save_sine_con_data(){
    console.warn("save con data");
    window.sine_con["amp"] = document.getElementById("UI_amp").value;
    window.sine_con["freq"] = document.getElementById("UI_freq").value;
    window.sine_con["phase_angle"] = document.getElementById("UI_phase_angle").value;
    window.sine_con["offset"] = document.getElementById("UI_offset").value;
    
    save_sim_area_data();
    
}
function save_sine_dis_data(){
    console.warn("save dis data");
    window.sine_con["amp"] = document.getElementById("UI_amp").value;
    window.sine_con["freq"] = document.getElementById("UI_freq").value;
    window.sine_con["phase_angle"] = document.getElementById("UI_phase_angle").value;
    window.sine_con["offset"] = document.getElementById("UI_offset").value;
    window.sine_dis["period"] = document.getElementById("UI_period").value;
    
    save_sim_area_data();
    
}
function save_pid_con_data(){
    window.pid_con["ts"] = document.getElementById("UI_ts").value;
    window.pid_con["kp"] = document.getElementById("UI_gainskp").value;
    window.pid_con["ki"] = document.getElementById("UI_gainski").value;
    window.pid_con["kd"] = document.getElementById("UI_gainskd").value;

    save_sim_area_data();
}
function save_pid_dis_data(){
    console.warn("save dis data");
    window.pid_con["ts"] = document.getElementById("UI_ts").value;
    window.pid_con["kp"] = document.getElementById("UI_gainskp").value;
    window.pid_con["ki"] = document.getElementById("UI_gainski").value;
    window.pid_con["kd"] = document.getElementById("UI_gainskd").value;
    window.pid_con["sample_time"] = document.getElementById("UI_sample_time").value;

    save_sim_area_data();
    
}
function save_sim_data(){

    window.simulate_motor.armature_resistance = document.getElementById("UI_armature_resistance").value;
    window.simulate_motor.armature_inductance = document.getElementById("UI_armature_inductance").value;
    window.simulate_motor.back_electromotive_force_constant = document.getElementById("UI_back_electromotive_force_constant").value;
    window.simulate_motor.torque_constant = document.getElementById("UI_torque_constant").value;
    window.simulate_motor.motor_rotor_inertia = document.getElementById("UI_motor_rotor_inertia").value;
    window.simulate_motor.viscous_friction_coefficient = document.getElementById("UI_viscous_friction_coefficient").value;
        

}

/*---------------------------------------------------------------
these 2 functiosns basically create basic forms of input boxes or sidebar boxes.
---------------------------------------------------------------*/
function sbf_basicform(action, for_d, label_text, Unitofmeasure, type, step, value=0, size=7) {

    //unit of measure is genuinly different symbols and it changes a lot,
    //  so im going to do a list, and each of these is gonna have their 
    //corresponding. yeah

    // <div class="sidebar_basic_elements">
    const bf = document.createElement("div");
    bf.classList.add("sidebar_basic_elements");

    // <form action="/communicationScript.py">
    const form = document.createElement("form");
    form.action = action;

    // <label class="descriptor" for="vcc">Amplitude: </label>
    const label = document.createElement("label");
    label.classList.add("descriptor");
    label.htmlFor = for_d;
    label.textContent = label_text;

    // <div>
    const div = document.createElement("div");
    div.classList.add("formula_input_right");



    // <input ...>
    const input = document.createElement("input");
    input.type = type; //number
    input.step = step; //0.01  //i genuinly hope this doesnt cause any mistakes
    input.name = for_d; //Amp 
    input.id = "UI_" + for_d; //UI_amp
    input.style.width = size + "em"; // 7 i think its always gonna be 7
    input.value = value;

    input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
        }
    });

    // Put everything together
    div.innerHTML = Unitofmeasure;
    div.appendChild(input);

    form.appendChild(label);
    form.appendChild(div);

    bf.appendChild(form);

    return bf;
}
function sbf_gains(action, for_d, label_text, Unitofmeasure, type, step) {

    //unit of measure is genuinly different symbols and it changes a lot,
    //  so im going to do a list, and each of these is gonna have their 
    //corresponding. yeah

    // <div class="sidebar_basic_elements">
    const bf = document.createElement("div");
    bf.classList.add("sidebar_basic_elements");

    // <form action="/communicationScript.py">
    const form = document.createElement("form");
    form.action = action;

    // <label class="descriptor" for="vcc">Amplitude: </label>
    const label = document.createElement("label");
    label.classList.add("descriptor");
    label.htmlFor = for_d;
    label.textContent = label_text;

    //3 for gains

    // <div> for unit of measure
    const div = document.createElement("div");
    div.innerHTML = dictionaryUnitsOfMeasure["gains_kp"];

    const input = document.createElement("input");
    input.type = type; //number
    input.step = step; //0.01  //i genuinly hope this doesnt cause any mistakes
    input.name = for_d + "kp"; //Amp 
    input.id = "UI_" + for_d + "kp"; //UI_amp
    input.style.width = 8 + "em"; 
    input.value = window.pid_con["kp"];
    div.appendChild(input);
    
    
    
    div.insertAdjacentHTML("beforeend", dictionaryUnitsOfMeasure["gains_ki"]);
    
    const input2 = document.createElement("input");
    input2.type = type; //number
    input2.step = step; //0.01  //i genuinly hope this doesnt cause any mistakes
    input2.name = for_d + "ki"; //Amp 
    input2.id = "UI_" + for_d + "ki"; //UI_amp
    input2.style.width = 8 + "em"; 
    input2.value = window.pid_con["ki"];
    div.appendChild(input2);
    
    
    

    div.insertAdjacentHTML("beforeend", dictionaryUnitsOfMeasure["gains_kd"]);
    
    const input3 = document.createElement("input");
    input3.type = type; //number
    input3.step = step; //0.01  //i genuinly hope this doesnt cause any mistakes
    input3.name = for_d + "kd"; //Amp 
    input3.id = "UI_" + for_d + "kd"; //UI_amp
    input3.style.width = 8 + "em"; 
    input3.value = window.pid_con["kd"];
    div.appendChild(input3);






    form.appendChild(label);
    div.style.setProperty("padding-left", "40px");
    form.appendChild(div);


    bf.appendChild(form);

    return bf;
}

/*---------------------------------------------------------------
functions each of the side bar states need
---------------------------------------------------------------*/
//delete all from side bar
function clean_sidebar(father){
    //the logic behind this is that when we start clearing any page, we want to save data
    if(window.sb_state == STEP){
        save_step_data();
    } else if(window.sb_state == SINE){

        //we are entering anything that is not sine and the sb_state hasnt changed, then lets save this info
        if(window.sb_condis == CONTINUOUS){
            save_sine_con_data();
        } else{
            save_sine_dis_data();
        }
        
    } else if(window.sb_state == PID){
        if(window.sb_condis == CONTINUOUS){
            save_pid_con_data();
        } else{
            save_pid_dis_data();
        }
    }

    father.removeChild(document.getElementById("sb_contents"));
}
//  main div for side bar contents
function creating_sidebar_contents(father){
    let sidebar_contents = document.createElement('div');
    sidebar_contents.classList.add('sidebar_contents_css');
    sidebar_contents.setAttribute('id', 'sb_contents');
    father.appendChild(sidebar_contents);
    return sidebar_contents;
}
// a sub division within the side bar. wasy way to create it and return it
function creating_sidebar_group(father){
    let creating_sbg = document.createElement('div');
    creating_sbg.classList.add('sidebar_group');
    father.appendChild(creating_sbg);
    return creating_sbg;
}



/*---------------------------------------------------------------
changing the colors of the button for the side bar state.
you tecnically need both previous and the state you are moving to. 
but the previous state is a global variable thus it is infered from there.
---------------------------------------------------------------*/
function change_button_highlights(current_button){
    //sb state is the previously highlighted button
    //current button should be the new one to highlight
    let b_previous_button;
    if (window.sb_state == STEP) {
        b_previous_button = document.getElementById("b_step");
    } else if (window.sb_state == PID) {
        b_previous_button = document.getElementById("b_pid");
    } else if (window.sb_state == SINE) {
        b_previous_button = document.getElementById("b_sine");
    } else if (window.sb_state == INITIATE) {
        return STEP; //if we are initiating there is no reason to change anything
    }


    //translate current button to text:
    let current_button_name;

    if (current_button == STEP) {
        current_button_name = "b_step";
    } else if (current_button == PID) {
        current_button_name = "b_pid";
    } else if (current_button == SINE) {
        current_button_name = "b_sine";
    }


    
    b_previous_button.classList.add("sb_button");
    b_previous_button.classList.remove("sb_button_selected");

    const new_button = document.getElementById(current_button_name);
    new_button.classList.remove("sb_button");
    new_button.classList.add("sb_button_selected");

    return current_button;
}


/*---------------------------------------------------------------
motor parameters for simulation functionality.

you see that button that says edit motor parameters. basically these 3 functions are in charge of all of it.
---------------------------------------------------------------*/
function mp_close_func(){
    save_sim_data();
    document.body.removeChild(document.getElementById("mp_menu"));
}
function summon_mp_menu(){
    const background = document.createElement("div");
    background.className = "mp_background";
    background.id = "mp_menu"

    const box = document.createElement("div");
    box.className = "mp_box";

    const top = document.createElement("div");
    top.id = "mp_box_top";

    

    //Create close mp
    const close_mp = document.createElement("img");
    close_mp.src = "images/remove.png";
    close_mp.alt = "close";
    close_mp.classList.add("mp_close");
    close_mp.id = "mp_close";

    // Run mp_close() when clicked
    close_mp.addEventListener("click", mp_close_func);

    // Add GIF to contents
    
    
    
    
    const contents = document.createElement("div");
    contents.id = "mp_box_contents";
    
    box.appendChild(top);
    top.appendChild(close_mp)
    

    box.appendChild(contents);

    // Put box inside background
    background.appendChild(box);

    // Put everything into the body
    document.body.appendChild(background);



    const sbc = creating_sidebar_contents(contents);

    //create sidebar group with heights:
    const sbg = creating_sidebar_group(sbc);
    

    const armature_resistance = sbf_basicform(
        "/communicationScript.py",
        "armature_resistance",
        "Armature resistance:",
        dictionaryUnitsOfMeasure["armature_resistance"],
        "number",
        0.01, 
        window.simulate_motor.armature_resistance,
        6
    );
    sbg.appendChild(armature_resistance);
    
    const armature_inductance = sbf_basicform(
        "/communicationScript.py",
        "armature_inductance",
        "Armature inductance:",
        dictionaryUnitsOfMeasure["armature_inductance"],
        "number",
        0.01,
        window.simulate_motor.armature_inductance,
        6
    );
    sbg.appendChild(armature_inductance);

    const back_electromotive_force_constant = sbf_basicform(
        "/communicationScript.py",
        "back_electromotive_force_constant",
        "Back electromotive force constant:",
        dictionaryUnitsOfMeasure["back_electromotive_force_constant"],
        "number",
        0.01,
        window.simulate_motor.back_electromotive_force_constant,
        6
    );
    sbg.appendChild(back_electromotive_force_constant);
    

    const torque_constant = sbf_basicform(
        "/communicationScript.py",
        "torque_constant",
        "Torque constant:",
        dictionaryUnitsOfMeasure["torque_constant"],
        "number",
        0.01,
        window.simulate_motor.torque_constant,
        6
    );
    sbg.appendChild(torque_constant);


    const motor_rotor_inertia = sbf_basicform(
        "/communicationScript.py",
        "motor_rotor_inertia",
        "Motor rotor inertia:",
        dictionaryUnitsOfMeasure["motor_rotor_inertia"],
        "number",
        0.01,
        window.simulate_motor.motor_rotor_inertia,
        6
    );
    sbg.appendChild(motor_rotor_inertia);


    const viscous_friction_coefficient = sbf_basicform(
        "/communicationScript.py",
        "viscous_friction_coefficient",
        "Viscous friction coefficient:",
        dictionaryUnitsOfMeasure["viscous_friction_coefficient"],
        "number",
        0.01,
        window.simulate_motor.viscous_friction_coefficient,
        6
    );
    sbg.appendChild(viscous_friction_coefficient);



}
function create_area_for_motor_parameters(father){
    const sb_elements = document.createElement('div');
    sb_elements.classList.add('sidebar_basic_elements');
    father.appendChild(sb_elements);


    let text = document.createElement('p');
    text.innerText = "Simulated Motor:  "
    sb_elements.appendChild(text)


    const btn = document.createElement("button");
    btn.className = "sd_summon_mp_menu";
    btn.innerText = "Edit variables";
    btn.addEventListener("click", () => summon_mp_menu());
    sb_elements.appendChild(btn);
}


/*---------------------------------------------------------------
These functions now below each assing some form of value to the area that has the buttons:
- Simulated Control
- Real Time Control
- System Identification
---------------------------------------------------------------*/
//this function in particular just creates the 3 buttons and assings them their events.
function sim_real_identification(father, selected_button, state_clicked){
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("sri_area");
    father.appendChild(buttonContainer);

    //show correct selected one.
    //i don thighlitgh the correct one.

    const button_sim_1 = document.createElement("button");
    button_sim_1.innerText = "Simulated control";
    if(selected_button == SIMULATED_CONTROL){
        button_sim_1.classList.add("sri_button_selected");
    } else{
        button_sim_1.classList.add("sri_button");
    }
    button_sim_1.id = "b_simulated_control";
    buttonContainer.appendChild(button_sim_1);
    
    const button_sim_2 = document.createElement("button");
    button_sim_2.innerText = "Real Time Control";
    if(selected_button == REAL_TIME_CONTROL){
        button_sim_2.classList.add("sri_button_selected");
    } else{
        button_sim_2.classList.add("sri_button");
    }
    button_sim_2.id = "b_real_time_control";
    buttonContainer.appendChild(button_sim_2);
    
    const button_sim_3 = document.createElement("button");
    button_sim_3.innerText = "System Identification";
    if(selected_button == SYSTEM_IDENTIFICATION){
        button_sim_3.classList.add("sri_button_selected");
    } else{
        button_sim_3.classList.add("sri_button");
    }
    button_sim_3.id = "b_system_identification";
    buttonContainer.appendChild(button_sim_3);
    
    //assing funtions to each of these.
    button_sim_1.addEventListener("click", () => {
        simulate_area(father, SIMULATED_CONTROL, state_clicked);
    });
    button_sim_2.addEventListener("click", () => {
        simulate_area(father, REAL_TIME_CONTROL, state_clicked);
    });
    button_sim_3.addEventListener("click", () => {
        simulate_area(father, SYSTEM_IDENTIFICATION, state_clicked);
    });




}
//changes the button highlights
function change_sim_area_buttons_colors(selected_button){
    
    let b_previous_button;
    if (window.sim_area == SIMULATED_CONTROL) {
        b_previous_button = document.getElementById("b_simulated_control");
    } else if (window.sim_area == REAL_TIME_CONTROL) {
        b_previous_button = document.getElementById("b_real_time_control");
    } else if (window.sim_area == SYSTEM_IDENTIFICATION) {
        b_previous_button = document.getElementById("b_system_identification");
    } 
    
    
    let selected_button_element;
    if (selected_button == SIMULATED_CONTROL) {
        selected_button_element = document.getElementById("b_simulated_control");
    } else if (selected_button == REAL_TIME_CONTROL) {
        selected_button_element = document.getElementById("b_real_time_control");
    } else if (selected_button == SYSTEM_IDENTIFICATION) {
        selected_button_element = document.getElementById("b_system_identification");
    } 
    
    
    b_previous_button.classList.add("sri_button");
    b_previous_button.classList.remove("sri_button_selected");
    
    selected_button_element.classList.remove("sri_button");
    selected_button_element.classList.add("sri_button_selected");

    return selected_button; ///we return the button that is the new correct

}
//this changes whats shown or hidden with each of the windows
function changes_caused_by_sri_buttons(where_is_this_code_called, from_state, to_state, from_sri, to_sri){
    //example call : changes_caused_by_sri_buttons(CCBSB_EXEC_CHANGE_TO_SECTION, window.sb_state, STEP, window.sim_area);
    //this function agregates all the visibility chagnes done to the sidebar.
    //we are working in lines 
    // 1126
    // 1200
    // 1600

    //also these are the variables being used for where is this code called:
    // const CCBSB_EXEC_SRI = 0;
    // const CCBSB_EXEC_CHANGE_TO_SECTION = 1;

    //adittionally from state and to state basically beahve the same when inside of sri call, because they are in the same state just changing the sri

    if(where_is_this_code_called == CCBSB_EXEC_SRI){
        console.warn("SRI cahngess in visibility");
        
        //this is step visibility functions.
        //if we are in step and changing to real motor.
        if(to_state == STEP){
            if(to_sri == REAL_TIME_CONTROL)
                invertVisibility(document.getElementById("CycleDutyBox"));
            
            //if we are in Step and we are getting out of real time control and we are currently in realtime control
            if(to_sri != REAL_TIME_CONTROL && from_sri == REAL_TIME_CONTROL)
                invertVisibility(document.getElementById("CycleDutyBox"));
            
            //System identification changes when clicking the button
            if(to_sri == SYSTEM_IDENTIFICATION)
                invertVisibility(document.getElementById("step_box_1"));
            
            //if we are in Step and we are getting out of real time control and we are currently in realtime control
            if(to_sri != SYSTEM_IDENTIFICATION && from_sri == SYSTEM_IDENTIFICATION)
                invertVisibility(document.getElementById("step_box_1"));
        }
        if(to_state == SINE){
            if(to_sri == SYSTEM_IDENTIFICATION){
                invertVisibility(document.getElementById("condis_group_id"));
                invertVisibility(document.getElementById("sine_main_formula_container_id"));
            }
            
            if(to_sri != SYSTEM_IDENTIFICATION && from_sri == SYSTEM_IDENTIFICATION){
                invertVisibility(document.getElementById("condis_group_id"));
                invertVisibility(document.getElementById("sine_main_formula_container_id"));
            }
        }
        if(to_state == PID){
            if(to_sri == SYSTEM_IDENTIFICATION){
                invertVisibility(document.getElementById("pid_subgroup_box1"));
                invertVisibility(document.getElementById("pid_subgroup_box2"));
                invertVisibility(document.getElementById("pid_subgroup_box3"));
                invertVisibility(document.getElementById("pid_subgroup_box4"));
                
            }
            
            if(to_sri != SYSTEM_IDENTIFICATION && from_sri == SYSTEM_IDENTIFICATION){
                invertVisibility(document.getElementById("pid_subgroup_box1"));
                invertVisibility(document.getElementById("pid_subgroup_box2"));
                invertVisibility(document.getElementById("pid_subgroup_box3"));
                invertVisibility(document.getElementById("pid_subgroup_box4"));
            }
        }
        
        
    }
    else if(where_is_this_code_called == CCBSB_EXEC_CHANGE_TO_SECTION){
        console.warn("SRI changes in section");
        if(from_state == INITIATE){
            return 0;
        }
        
        if(from_state != STEP && to_state == STEP){
            if(to_sri == SYSTEM_IDENTIFICATION){
                invertVisibility(document.getElementById("step_box_1"));
            }
        }
        if(from_state != SINE && to_state == SINE){
            if(to_sri == SYSTEM_IDENTIFICATION){
                invertVisibility(document.getElementById("condis_group_id"));
                invertVisibility(document.getElementById("sine_main_formula_container_id"));
            }
        }
        if(from_state != PID && to_state == PID){
            if(to_sri == SYSTEM_IDENTIFICATION){
                invertVisibility(document.getElementById("pid_subgroup_box1"));
                invertVisibility(document.getElementById("pid_subgroup_box2"));
                invertVisibility(document.getElementById("pid_subgroup_box3"));
                invertVisibility(document.getElementById("pid_subgroup_box4"));
            }
        }
    }
}
//saving sim area data
function save_sim_area_data(){
    if(window.sim_area == REAL_TIME_CONTROL){
        window.real_vcc = document.getElementById("UI_vcc").value;
    }
    else if(window.sim_area == SIMULATED_CONTROL){
        window.simulate_time = document.getElementById("UI_time").value;
    }

}

//do we call upon this function when the user clicks the button again as in step and so on.
function simulate_area(father, button_clicked=SAME_AS_LAST, state_clicked){

    let sbg_sri;

    if((window.sb_state == INITIATE) || (button_clicked == SAME_AS_LAST)){
        //we are in initiate:
        sbg_sri = creating_sidebar_group(father);
        sbg_sri.id = "sri_section_container";
        sbg_sri.style.marginTop = "10px";


        //if it is initiate the reason we are here, then it should be fine
        button_clicked = window.sim_area;


    }else{
        //we are in a staet which the group still exists.

        //you clicked the same button u buffun
        if(button_clicked == window.sim_area){
            return 0;
        }

        sbg_sri = document.getElementById("sri_section_container");
        save_sim_area_data();
        sbg_sri.replaceChildren();


        //change visibility of constents below:
        changes_caused_by_sri_buttons(CCBSB_EXEC_SRI, window.sb_state, state_clicked, window.sim_area, button_clicked);






    }

    
    //if we are in initiate, we cant really change the visibility of the object
    //if we are on changing between buttons, then we can change it.
    //as long as the button is not same as last. we should be fine.


    
    

    //create area to select mode
    sim_real_identification(sbg_sri, button_clicked, state_clicked);



    
    
    
    if(button_clicked == SIMULATED_CONTROL){
        
        //variable area depending on the button selected.
        
        create_area_for_motor_parameters(sbg_sri);
        
        //add a time input and a play simulation
        const bf = sbf_basicform( "/communicationScript.py", "time", "Time:", "T", "number", 0.01, window.simulate_time , 7);
        sbg_sri.appendChild(bf);

        
    }else if(button_clicked == REAL_TIME_CONTROL){
        
        const systemStatus = document.createElement("div");
        systemStatus.className = "sidebar_basic_elements system_status";
        systemStatus.id = "system_id";
        
        systemStatus.style.marginTop = "5px";
        systemStatus.style.marginBottom = "5px";
        systemStatus.style.paddingTop = "12px";
        systemStatus.style.paddingBottom = "12px";
        
        
        const statusText = document.createElement("p");
        statusText.textContent = "  System Off";

        const consoleBox = document.createElement("div");
        consoleBox.innerHTML = `<esp32-console></esp32-console>`;


                
        const statusBox = document.createElement("div");
        statusBox.style.display = "flex"
        statusBox.innerHTML = icons["circle"];
        

        statusBox.appendChild(statusText);
        systemStatus.appendChild(statusBox);
        sbg_sri.appendChild(systemStatus);
        sbg_sri.appendChild(consoleBox);
        
        const bf = sbf_basicform( "/communicationScript.py", "vcc", "Vcc:", " ", "number", 0.01, window.real_vcc, 10);
        sbg_sri.appendChild(bf);
        
        
        
    }
    // else if(button_clicked == SYSTEM_IDENTIFICATION){
        
    // }
    
    
    
    
    
    //button below the inputs for each simulation
    const sri_button_container = document.createElement("div");
    sri_button_container.className = "pas_button_container";
    
    
    //creating buttons that we need for each window in particular
    
    startButton_sim = { id: "b_start_sim", icon: icons["play"]};
    startButton_real = { id: "b_start_real", icon: icons["play"]};
    startButton_identify = { id: "b_start_identify", icon: icons["play"]};
    stopButton = { id: "b_stop", icon: icons["stop"]};
    
    
    // loadButton = { id: "b_load", text: "Load" };
    loadButton = { id: "b_load", icon: icons["load"]};
    // saveButton = { id: "b_save", text: "Save" };
    saveButton = { id: "b_save", icon: icons["save"]};
    
    
    let sri_buttons = [];
    
    if(SIMULATED_CONTROL == button_clicked){
        sri_buttons.push(startButton_sim);
        sri_buttons.push(saveButton);
        
    }else if(REAL_TIME_CONTROL== button_clicked){
        sri_buttons.push(startButton_real);
        sri_buttons.push(stopButton);
        sri_buttons.push(saveButton);
        
    }else if(SYSTEM_IDENTIFICATION== button_clicked){
        sri_buttons.push(startButton_identify);
        sri_buttons.push(loadButton);
        sri_buttons.push(saveButton);
    }
    
    sri_buttons.forEach(({ id, icon, iconClass, text }) => {
        const button = document.createElement("button");
        button.className = "pas_buttons";
        button.id = id;
        
        if (icon) {
            button.insertAdjacentHTML("beforeend", icon);
        } else {
            button.textContent = text;
        }
        
        //assining functions:
        if(id == "b_start_sim"){
            button.addEventListener("click", () => window.on_play_simulation_button_js());
        }
        if(id == "b_start_identify"){
            button.addEventListener("click", () => get_last_predicted_values(sbg_sri));
        }
        
        sri_button_container.appendChild(button);
    });

    //create container where play and shi will go
    const sb_elements_3 = document.createElement('div');
    sb_elements_3.classList.add('sidebar_basic_elements-no_padding');
    sb_elements_3.appendChild(sri_button_container);
    sbg_sri.appendChild(sb_elements_3);


    // window.sim_area = change_sim_area_buttons_colors(button_clicked);
    window.sim_area  = button_clicked;

}





/*---------------------------------------------------------------
Exists to show the predictions of the motor parameters based on sine or step data
(currently this is slightly limited functionality compared to the final functionality.)
---------------------------------------------------------------*/
function get_last_predicted_values(father){
    //this is supposed to have complex logic on how to get previous gotten data that lives in the python file. 
    /*
    this is gonna be a dilemma because currently our libraries are in python.

    everytime we graoh somethign we could prepredict what the values are and then just get them and showem here from the python file.

    or have 2 assigned events. and js events awaits for python promise. i like this much more.
    */

    

    const sbg = creating_sidebar_group(father);
    sbg.style.width = '270px';
    sbg.style.paddingLeft = '20px';
    

    if (window.identify_results){       
        for (const [key, value] of Object.entries(JSON.parse(window.identify_results))) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.padding = '4px 0';
            row.classList.add("sri_results")

            const keySpan = document.createElement('span');
            keySpan.textContent = key;

            const valueSpan = document.createElement('span');
            valueSpan.textContent = value.toPrecision(3);

            row.appendChild(keySpan);
            row.appendChild(valueSpan);
            sbg.appendChild(row);
        }
    }
}












//change to sine
document.getElementById("b_sine").addEventListener("click", () => {
    change_to_sine(CONTINUOUS);
});

function change_to_sine(condis) {
    //info we need:
    const place = document.getElementById("sb_main");

    
    //check if we are not there currently
    if (window.sb_state == SINE) {
        if (window.sb_condis == condis) {
            return 0;
        }
    }
    
    //delete all from side bar
    //we arrive at sine and we want to save the previous data.
    clean_sidebar(place);
    

    window.sb_condis = condis; //because they differ after this

    //creating sidebar
    const sbc = creating_sidebar_contents(place);

    simulate_area(sbc, SAME_AS_LAST, SINE);

    //create sidebar group with heights:
    const sbg = creating_sidebar_group(sbc);
    sbg.id = "condis_group_id";

    //create continuous or discrete
    if (condis == CONTINUOUS) {
        sbg.innerHTML = ConDisHtml;
    }
    else {
        sbg.innerHTML = ConDisHtml_dis;
    }

    //we have to have 2 versions

    //if we give  this a add event on action what exactly will happne
    /*
    code executes for the first time.
    it arrives here, and gives events on listentes
    this even listener says that if we call continuous or discrete.
    if it is different we call a sine continuos because we already have the code,. we just have to modify the insides
    but this for example code would be duplicated so we create a formula that assings the event listeners

    change of plans, we make all the variables dependant on 0 or 1, and this explain if it is con or dis
    thus it makes sense. i think, i have to see the desing of both of the pages.

    */
    // document.getElementById("ui_sg_con").addEventListener("click", change_to_sine_con); 
    // document.getElementById("ui_sg_dis").addEventListener("click", change_to_sine_dis); 

    document.getElementById("ui_sg_con").addEventListener("click", () => {
        change_to_sine(CONTINUOUS);
    });
    document.getElementById("ui_sg_dis").addEventListener("click", () => {
        change_to_sine(DISCRETE);
    });



    const sbg2 = document.createElement('div');
    sbg2.id = "sine_main_formula_container_id";
    sbg2.classList.add('sidebar_group');

    sbc.appendChild(sbg2);

    const sbf = document.createElement('div');
    sbf.classList.add('sidebar_basic_elements');
    sbf.classList.add('formula');
    sbf.style.fontSize = '22px';
    sbg2.appendChild(sbf);

    if (condis == CONTINUOUS) {
        sbf.innerHTML = dictionaryFormulas["sine"];
    }
    else {
        sbf.innerHTML = dictionaryFormulas["sine_dis"];
    }

    //function sbf_basicform(action, for_d, label_text, Unitofmeasure, type, step) {
    //              missing adding id i believe? might not be needed
    const bf = sbf_basicform( "/communicationScript.py", "amp", "Amplitude:", dictionaryUnitsOfMeasure["amp"], "number", 0.01, window.sine_con["amp"], 7);
    sbg2.appendChild(bf);

    const freq = sbf_basicform( "/communicationScript.py", "freq", "Frequency:", dictionaryUnitsOfMeasure["omega"], "number", 0.01, window.sine_con["freq"]);
    sbg2.appendChild(freq);

    const phase_angle = sbf_basicform( "/communicationScript.py", "phase_angle", "Phase Angle:", dictionaryUnitsOfMeasure["phi"], "number", 0.01, window.sine_con["phase_angle"]);
    sbg2.appendChild(phase_angle);

    const offset = sbf_basicform( "/communicationScript.py", "offset", "Offset:", dictionaryUnitsOfMeasure["delta"], "number", 0.01, window.sine_con["offset"]);
    sbg2.appendChild(offset);


    if (condis == DISCRETE) {
        const offset = sbf_basicform( "/communicationScript.py", "period", "Period:", dictionaryUnitsOfMeasure["period"], "number", 0.01, window.sine_dis["period"] );
        sbg2.appendChild(offset);
    }

    changes_caused_by_sri_buttons(CCBSB_EXEC_CHANGE_TO_SECTION, window.sb_state, SINE, window.sim_area, window.sim_area);

    //changed code here hope this doesnt break the button changing colors for some execption i didnt see
    window.sb_state = change_button_highlights(SINE);

    return 0;
}










//change to step
//this order reveals that javascript runs the functions first, and then goes trhough the code, which makes it work but it probably shoudnt.
document.getElementById("b_step").addEventListener("click", change_to_step);

function change_to_step() {
    //check if we are not there currently
    if (window.sb_state == STEP) {
        return 0;
    }

       //info we need:
    const place = document.getElementById("sb_main");


    //delete all from side bar
    clean_sidebar(place);

    //creating sidebar
    const sbc = creating_sidebar_contents(place);
    
    //create the simulate area (its gonna have to be renamed as it doesnt stand for that now)
    simulate_area(sbc, SAME_AS_LAST, STEP);




    //actual content of the step side of the sidebar
    //create sidebar group
    const sbg = creating_sidebar_group(sbc);
    sbg.id = "step_box_1"


    const sbf = document.createElement('div');
    sbf.classList.add('sidebar_basic_elements');
    sbf.classList.add('formula');
    sbf.style.fontSize = '22px';
    sbg.appendChild(sbf);

    sbf.innerHTML = dictionaryFormulas["step"];

    //create continuous or discrete



    //3 inputs for step
    const bf = sbf_basicform( "/communicationScript.py", "amp", "Amplitude:", dictionaryUnitsOfMeasure["amp"], "number", 0.01, window.step["amp"] );
    sbg.appendChild(bf);

    const freq = sbf_basicform( "/communicationScript.py", "it", "Initial Time:", dictionaryUnitsOfMeasure["timezero"], "number", 0.01, window.step["it"] );
    sbg.appendChild(freq);

    const offset = sbf_basicform( "/communicationScript.py", "offset", "Offset:", dictionaryUnitsOfMeasure["delta"], "number", 0.01, window.step["offset"] );
    sbg.appendChild(offset);







    //slider duty box
    const sbg2 = creating_sidebar_group(sbc);
    sbg2.id = "CycleDutyBox";
    if(window.sim_area != REAL_TIME_CONTROL)
        sbg2.style.display = "none"; //we start in simulated so we dont have to show this box

    sbg2.innerHTML = SliderDutyCycleHtml;

    const sign = sbf_basicform( "/communicationScript.py", "sign", "Sign V(t):", dictionaryUnitsOfMeasure["none"], "number", 0.01);
    sbg2.appendChild(sign);
    
    //this is needed. in fact im impressed this works. id think browser timings would mess this up:
    const SliderDutyCycle = document.getElementById("SliderDutyCycle");
    const UI_dutycycle = document.getElementById("UI_dutycycle");

    // Moving the slider updates the box
    SliderDutyCycle.addEventListener("input", function () {
        UI_dutycycle.value = SliderDutyCycle.value;
    });

    // Editing the box updates the slider
    UI_dutycycle.addEventListener("input", function () {
        SliderDutyCycle.value = UI_dutycycle.value;
    });


    //changes to visual aspects  = [we are doing this because of editability though it might be a bit redundant]
    //     const CCBSB_EXEC_SRI = 0;
    //     const CCBSB_EXEC_CHANGE_TO_SECTION = 1;
    changes_caused_by_sri_buttons(CCBSB_EXEC_CHANGE_TO_SECTION, window.sb_state, STEP, window.sim_area, window.sim_area);
    //this function, is gonna be called out twice sometimes. which is a problem.

    window.sb_state = change_button_highlights(STEP);


    return 0;
}















document.getElementById("b_pid").addEventListener("click", () => {
    change_to_PID(CONTINUOUS);
});

//change to pid
function change_to_PID(condis) {
    //check if we are not there currently
    if (window.sb_state == PID) {
        if (window.sb_condis == condis) {
            return 0;
        }
    }
    
    //delete all from side bar
    const place = document.getElementById("sb_main");
    clean_sidebar(place);

    //because they differ after this 
    // //this should also work when changing fomr sine to PID
    window.sb_condis = condis;

    //creating sidebar
    const sbc = creating_sidebar_contents(place);

    simulate_area(sbc, SAME_AS_LAST, PID);

    //create sidebar group with heights:
    const sbg = creating_sidebar_group(sbc);
    sbg.id = "pid_subgroup_box1";

    //create continuous or discrete
    if (condis == CONTINUOUS) {
        sbg.innerHTML = ConDisHtml;
    }
    else {
        sbg.innerHTML = ConDisHtml_dis;
    }

    document.getElementById("ui_sg_con").addEventListener("click", () => {
        change_to_PID(CONTINUOUS);
    });
    document.getElementById("ui_sg_dis").addEventListener("click", () => {
        change_to_PID(DISCRETE);
    });





    // check if we need to modify the side bar just for this. which would imply that any kind of change is gonna call out verify css adn we gonna group changes there.------------------

    //there is 3 more containers after this


    //conatiner one having 
    const sbg2 = document.createElement('div');
    sbg2.classList.add('sidebar_group');
    sbg2.id = "pid_subgroup_box2";
    sbc.appendChild(sbg2);

    //formula
    const sbf = document.createElement('div');
    sbf.classList.add('sidebar_basic_elements');
    sbf.classList.add('formula');
    sbf.style.fontSize = '22px';
    sbg2.appendChild(sbf);

    if (condis == CONTINUOUS) {
        sbf.innerHTML = dictionaryFormulas["pid"];
    }
    else {
        sbf.innerHTML = dictionaryFormulas["pid_dis"];
    }



    //input
    const bf = sbf_basicform(
        "/communicationScript.py",
        "ts",
        "Target Speed:",
        dictionaryUnitsOfMeasure[condis == CONTINUOUS ? "ts" : "ts_pid"],
        "number",
        0.01,
        window.pid_con["ts"] 
    );
    sbg2.appendChild(bf);



    //formula with title
    const sbf2 = document.createElement('div');
    sbf2.classList.add('sidebar_basic_elements');
    sbf2.classList.add('formula');
    sbf2.style.fontSize = '16px';
    sbg2.appendChild(sbf2);

    if (condis == CONTINUOUS) {
        sbf2.innerHTML = dictionaryFormulas["error_singal"];
    }
    else {
        sbf2.innerHTML = dictionaryFormulas["error_singal_dis"];
    }

    //input
    // 2 things
    //      a button saying digital filters
    //      a checkmark saying Filter coefficient (N)

    

    if (condis == CONTINUOUS) {
        const sbf3 = document.createElement('div');
        sbf3.classList.add('sidebar_basic_elements');
        sbf3.classList.add('formula');
        sbf3.style.fontSize = '16px';
        sbg2.appendChild(sbf3);
        sbf3.innerHTML = dictionaryFormulas["sample_time"];
    }
    else {
        const freq = sbf_basicform(
            "/communicationScript.py",
            "sample_time",
            "Sample Time:",
            dictionaryUnitsOfMeasure["sample_time"],
            "number",
            0.01,
            window.pid_con["sample_time"]
        );
        sbg2.appendChild(freq);
    }

    
    
    






    //container 2
    const sbg3 = document.createElement('div');
    sbg3.classList.add('sidebar_group');
    sbg3.id = "pid_subgroup_box3";
    sbc.appendChild(sbg3);

    const bf1 = sbf_gains(
        "/communicationScript.py",
        "gains",
        "Gains:",
        dictionaryUnitsOfMeasure["none"],
        "number",
        0.01
    );
    sbg3.appendChild(bf1);


    const sbg4 = document.createElement('div');
    sbg4.classList.add('sidebar_group');
    sbg4.id = "pid_subgroup_box4";
    sbc.appendChild(sbg4);



    const sbf4 = document.createElement('div');
    sbf4.classList.add('sidebar_basic_elements');
    sbf4.classList.add('formula');
    sbf4.style.fontSize = '16px';
    sbg4.appendChild(sbf4);

    if (condis == CONTINUOUS) {
        sbf4.innerHTML = dictionaryFormulas["proportional_term"];
    }
    else {
        sbf4.innerHTML = dictionaryFormulas["proportional_term_dis"];
    }

    const sbf5 = document.createElement('div');
    sbf5.classList.add('sidebar_basic_elements');
    sbf5.classList.add('formula');
    sbf5.style.fontSize = '16px';
    sbg4.appendChild(sbf5);

    if (condis == CONTINUOUS) {
        sbf5.innerHTML = dictionaryFormulas["integral_term"];
    }
    else {
        sbf5.innerHTML = dictionaryFormulas["integral_term_dis"];
    }

    const sbf6 = document.createElement('div');
    sbf6.classList.add('sidebar_basic_elements');
    sbf6.classList.add('formula');
    sbf6.style.fontSize = '16px';
    sbg4.appendChild(sbf6);

    if (condis == CONTINUOUS) {
        sbf6.innerHTML = dictionaryFormulas["derivative_term"];
    }
    else {
        sbf6.innerHTML = dictionaryFormulas["derivative_term_dis"];
    }






    //highlight the bar and unhighlight previous button
    if (window.sb_state != PID) {
        window.sb_state = change_button_highlights(PID);
    }

    return 0;
}











change_to_step();



//show error and current
function invertVisibility(item){
    if (item.style.display === "none") {
        item.style.display = "block";
    } else {
        item.style.display = "none";
    }
}

// //id_graph_container_

// const SPEED_AND_VOLTAGE = 0;
// const CURRENT_AND_ERROR = 1;

//we expect a 1 or a 0
function change_graphs(button_clicked){
    let count = 1;
    if(graphs_state == button_clicked){
        return 0;
    }

   //change the graphs visivility
    const div1 = document.getElementById("id_graph_container_1");
    const div2 = document.getElementById("id_graph_container_2");
    const div3 = document.getElementById("id_graph_container_3");
    const div4 = document.getElementById("id_graph_container_4");

    invertVisibility(div1);
    invertVisibility(div2);
    invertVisibility(div3);
    invertVisibility(div4);
    //change the buttons colors

    let btn1 = document.getElementById("b_speed_and_voltage");
    let btn2 = document.getElementById("b_current_and_error");

    if(button_clicked == SPEED_AND_VOLTAGE){
        let temp = btn2;
        btn2 = btn1;
        btn1 = temp;
    }
    

    btn1.classList.add("nav_button");
    btn1.classList.remove("nav_button_selected");
    //button 2 is gonna be the selected one
    btn2.classList.add("nav_button_selected");
    btn2.classList.remove("nav_button");



    graphs_state = button_clicked;
}

//these 2 can be compacted into one function with proper code design


const button_current_error = document.getElementById("b_current_and_error");

button_current_error.addEventListener("click", () => {
    change_graphs(CURRENT_AND_ERROR);
});
const button_speed_voltage = document.getElementById("b_speed_and_voltage");

button_speed_voltage.addEventListener("click", () => {
    change_graphs(SPEED_AND_VOLTAGE);
});






// at the end lets add the dom for the python scrpt
//so we fullfill python promise:

window.resolveJsReady();



