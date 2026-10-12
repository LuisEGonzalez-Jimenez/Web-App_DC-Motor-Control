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
    div.appendChild(input);



    div.insertAdjacentHTML("beforeend", dictionaryUnitsOfMeasure["gains_ki"]);

    const input2 = document.createElement("input");
    input2.type = type; //number
    input2.step = step; //0.01  //i genuinly hope this doesnt cause any mistakes
    input2.name = for_d + "ki"; //Amp 
    input2.id = "UI_" + for_d + "k1"; //UI_amp
    input2.style.width = 8 + "em"; 
    div.appendChild(input2);




    div.insertAdjacentHTML("beforeend", dictionaryUnitsOfMeasure["gains_kd"]);

    const input3 = document.createElement("input");
    input3.type = type; //number
    input3.step = step; //0.01  //i genuinly hope this doesnt cause any mistakes
    input3.name = for_d + "kd"; //Amp 
    input3.id = "UI_" + for_d + "kd"; //UI_amp
    input3.style.width = 8 + "em"; 
    div.appendChild(input3);






    form.appendChild(label);
    div.style.setProperty("padding-left", "40px");
    form.appendChild(div);


    bf.appendChild(form);

    return bf;
}

//save step data 
function save_step_data(){
    window.step["amp"] = document.getElementById("UI_amp").value;
    window.step["it"] = document.getElementById("UI_it").value;
    window.step["offset"] = document.getElementById("UI_offset").value;

    //these have yet to be utilized but im doing it in advance
    window.step["dutycycle"] = document.getElementById("UI_dutycycle").value;
    window.step["sign"] = document.getElementById("UI_sign").value;

}
function save_sine_con_data(){
    window.sine_con["amp"] = document.getElementById("UI_amp").value;
    window.sine_con["freq"] = document.getElementById("UI_freq").value;
    window.sine_con["phase_angle"] = document.getElementById("UI_phase_angle").value;
    window.sine_con["offset"] = document.getElementById("UI_offset").value;

}
function save_sine_dis_data(){
    window.sine_con["amp"] = document.getElementById("UI_amp").value;
    window.sine_con["freq"] = document.getElementById("UI_freq").value;
    window.sine_con["phase_angle"] = document.getElementById("UI_phase_angle").value;
    window.sine_con["offset"] = document.getElementById("UI_offset").value;
    window.sine_dis["period"] = document.getElementById("UI_period").value;

}
function save_sim_data(){

    window.simulate_motor.armature_resistance = document.getElementById("UI_armature_resistance").value;
    window.simulate_motor.armature_inductance = document.getElementById("UI_armature_inductance").value;
    window.simulate_motor.back_electromotive_force_constant = document.getElementById("UI_back_electromotive_force_constant").value;
    window.simulate_motor.torque_constant = document.getElementById("UI_torque_constant").value;
    window.simulate_motor.motor_rotor_inertia = document.getElementById("UI_motor_rotor_inertia").value;
    window.simulate_motor.viscous_friction_coefficient = document.getElementById("UI_viscous_friction_coefficient").value;
        

}

//delete all from side bar
function clean_sidebar(place){
    //the logic behind this is that when we start clearing any page, we want to save data
    if(window.sb_state == STEP){
        save_step_data()
    } else if(window.sb_state == SINE){

        //we are entering anything that is not sine and the sb_state hasnt changed, then lets save this info
        if(window.sb_condis == CONTINUOUS){
            save_sine_con_data()
        } else{
            save_sine_dis_data()
        }
        
    }

    place.removeChild(document.getElementById("sb_contents"));
}
//adddding content
//  main div for side bar contents
function creating_sidebar_contents(place){
    let sidebar_contents = document.createElement('div');
    sidebar_contents.classList.add('sidebar_contents_css');
    sidebar_contents.setAttribute('id', 'sb_contents');
    place.appendChild(sidebar_contents);
    return sidebar_contents;
}
function creating_sidebar_group(father){
    let creating_sbg = document.createElement('div');
    creating_sbg.classList.add('sidebar_group');
    father.appendChild(creating_sbg);
    return creating_sbg;
}

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


function create_system_and_vcc_area(father){
    const sidebarGroup = document.createElement("div");
    sidebarGroup.className = "sidebar_group sbgh2";

    const systemStatus = document.createElement("div");
    systemStatus.className = "sidebar_basic_elements system_status";
    systemStatus.id = "system_id";


    systemStatus.style.marginTop = "5px";
    systemStatus.style.marginBottom = "5px";

    systemStatus.style.paddingTop = "0px";
    systemStatus.style.paddingBottom = "0px";


    const statusText = document.createElement("p");
    statusText.textContent = "O | System Off";

    systemStatus.appendChild(statusText);
    sidebarGroup.appendChild(systemStatus);
    father.appendChild(sidebarGroup);
}


//while it is a global varibale the selected button, it is also when this is called that this variable represents the "previous state of the button."
function sim_real_identification(father, selected_button){
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
        simulate_area(father, SIMULATED_CONTROL);
    });
    button_sim_2.addEventListener("click", () => {
        simulate_area(father, REAL_TIME_CONTROL);
    });
    button_sim_3.addEventListener("click", () => {
        simulate_area(father, SYSTEM_IDENTIFICATION);
    });




}

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

//do we call upon this function when the user clicks the button again as in step and so on.
function simulate_area(father, button_clicked=SAME_AS_LAST){


    let sbg_sri;

    /*
    case 1
        initialize 
        SIMULATEd control

    case 2
        step "because it hasnt updated"
        same as last
    
        window sim area == simulated control
    
    */


    //so when we change func as in from step to sine, i would expect it to execute all the same.

    //if we arent in initiate OR we are moving from step to sine. because the we want the button to stay the same as the last
    //ive spent too much time here lets just do it fast.

    //what information do i need.

    //i need to know if we are initializing.
    //i need to know weather we are changing from sine to step.

    //if we are changing then i want button clicked to be the same as the last, AND to create it from 0.
    let cycleDutyExists = false;

    if((window.sb_state == INITIATE) || (button_clicked == SAME_AS_LAST)){
        //we are in initiate:
        console.warn("we create the sidebar from zero.")
        sbg_sri = creating_sidebar_group(father);
        sbg_sri.id = "sri_section_container";
        sbg_sri.style.marginTop = "10px";


        //if it is initiate the reason we are here, then it should be fine
        button_clicked = window.sim_area;


    }else{
        //we are in a staet which the group still exists.

        //you clicked the same button u buffun, it only means you get a zero back, u peasent. (might need to remove this coment later on. (imma forget this fs))
        if(button_clicked == window.sim_area){
            return 0;
        }

        sbg_sri = document.getElementById("sri_section_container");
        sbg_sri.replaceChildren();




        //SECTION IN WHICH WE DECIDE TO HIDE STUFF WHEN IN DIFFERENT AREAS OF THE CONTROL
        /*
            - basically when we enter different areas, for example in step we hide stuff at differnet areas of the sim
            - we only want to see duty cycle when in real time control.
            -  in identification we probably dont want to see anything.
        */
        //if we are in step and changing to real motor.
        if(window.sb_state == STEP && button_clicked == REAL_TIME_CONTROL)
            invertVisibility(document.getElementById("CycleDutyBox"));
        
        if(window.sb_state == STEP && button_clicked != REAL_TIME_CONTROL && window.sim_area == REAL_TIME_CONTROL)
            invertVisibility(document.getElementById("CycleDutyBox"));


        console.warn("removed all sri kids, but sri group should still exists.");
        
    }

    
    //if we are in initiate, we cant really change the visibility of the object
    //if we are on changing between buttons, then we can change it.
    //as long as the button is not same as last. we should be fine.


    
    

    //create area to select mode
    sim_real_identification(sbg_sri, button_clicked);



    
    
    
    if(button_clicked == SIMULATED_CONTROL){
        
        //variable area depending on the button selected.
        
        create_area_for_motor_parameters(sbg_sri);
        
        //add a time input and a play simulation
        const bf = sbf_basicform( "/communicationScript.py", "time", "Time:", "T", "number", 0.01, window.real_vcc , 7);
        sbg_sri.appendChild(bf);

        
    }else if(button_clicked == REAL_TIME_CONTROL){
        
        const systemStatus = document.createElement("div");
        systemStatus.className = "sidebar_basic_elements system_status";
        systemStatus.id = "system_id";
        
        systemStatus.style.marginTop = "5px";
        systemStatus.style.marginBottom = "5px";
        systemStatus.style.paddingTop = "0px";
        systemStatus.style.paddingBottom = "0px";
        
        const statusText = document.createElement("p");
        statusText.textContent = "O | System Off";
        
        systemStatus.appendChild(statusText);
        sbg_sri.appendChild(systemStatus);
        
        //does it add this empty?
        const bf = sbf_basicform( "/communicationScript.py", "vcc", "vcc:", " ", "number", 0.01, window.simulate_time, 10);
        sbg_sri.appendChild(bf);
        
        
        console.warn("everything got appended?");
        
        
        
    }
    // else if(button_clicked == SYSTEM_IDENTIFICATION){
        
    // }
    
    
    
    
    
    //button below the inputs for each simulation
    const sri_button_container = document.createElement("div");
    sri_button_container.className = "pas_button_container";
    
    
    //creating buttons that we need for each window in particular
    
    startButton_sim = { id: "b_start_sim", icon: "&#xf04b;" };
    startButton_real = { id: "b_start_real", icon: "&#xf04b;" };
    startButton_identify = { id: "b_start_identify", icon: "&#xf04b;" };
    stopButton = { id: "b_stop", iconClass: "fa fa-stop" };
    loadButton = { id: "b_load", text: "Load" };
    saveButton = { id: "b_save", text: "Save" };
    
    
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
            const i = document.createElement("i");
            i.className = "fa";
            i.innerHTML = icon;
            button.appendChild(i);
        } else if (iconClass) {
            const i = document.createElement("i");
            i.className = iconClass;
            button.appendChild(i);
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

    simulate_area(sbc, SAME_AS_LAST);

    //create sidebar group with heights:
    const sbg = creating_sidebar_group(sbc);

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
    sbg2.classList.add('sidebar_group');
    if (condis == CONTINUOUS) {
        sbg2.classList.add('sbgh5');
    }
    else {
        sbg2.classList.add('sbgh6');
    }

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
    const bf = sbf_basicform(
        "/communicationScript.py",
        "amp",
        "Amplitude:",
        dictionaryUnitsOfMeasure["amp"],
        "number",
        0.01,
        window.sine_con["amp"],
        7
    );
    sbg2.appendChild(bf);

    const freq = sbf_basicform(
        "/communicationScript.py",
        "freq",
        "Frequency:",
        dictionaryUnitsOfMeasure["omega"],
        "number",
        0.01,
        window.sine_con["freq"]
    );
    sbg2.appendChild(freq);

    const phase_angle = sbf_basicform(
        "/communicationScript.py",
        "phase_angle",
        "Phase Angle:",
        dictionaryUnitsOfMeasure["phi"],
        "number",
        0.01,
        window.sine_con["phase_angle"]
    );
    sbg2.appendChild(phase_angle);

    const offset = sbf_basicform(
        "/communicationScript.py",
        "offset",
        "Offset:",
        dictionaryUnitsOfMeasure["delta"],
        "number",
        0.01,
        window.sine_con["offset"]
    );
    sbg2.appendChild(offset);


    if (condis == DISCRETE) {
        const offset = sbf_basicform(
            "/communicationScript.py",
            "period",
            "Period:",
            dictionaryUnitsOfMeasure["period"],
            "number",
            0.01,
            window.sine_dis["period"]
        );
        sbg2.appendChild(offset);
    }



    //highlight the bar and unhighlight previous button
    if (window.sb_state != SINE) {
        window.sb_state = change_button_highlights(SINE);
    }

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
    simulate_area(sbc, SAME_AS_LAST);




    //actual content of the step side of the sidebar
    //create sidebar group
    const sbg = creating_sidebar_group(sbc);


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







    //we change to step change the button highlights
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

    //because they differ after this 
    // //this should also work when changing fomr sine to PID
    window.sb_condis = condis;

       //info we need:
    const place = document.getElementById("sb_main");


    //delete all from side bar
    clean_sidebar(place);

    //creating sidebar
    const sbc = creating_sidebar_contents(place);

    simulate_area(sbc, SAME_AS_LAST);

    //create sidebar group with heights:
    const sbg = creating_sidebar_group(sbc);

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
    sbg2.classList.add('sbgh4');
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
        0.01
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
            0.01
        );
        sbg2.appendChild(freq);
    }

    
    
    






    //container 2
    const sbg3 = document.createElement('div');
    sbg3.classList.add('sidebar_group');
    sbg3.classList.add('sbgh1_bigger_60');
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
    sbg4.classList.add('sbgh3');
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


//play and stop expand
// const button = document.getElementById("b_collapsible_arrow");
// const play_and_stop = document.getElementById("play_and_stop_container");

// button.addEventListener("click", () => {
//     play_and_stop.classList.toggle("expand");
// });


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



