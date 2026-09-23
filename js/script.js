//sidebar Functionality ---------------------------
const INITIATE = -1;
const STEP = 0;
const SINE = 1;
const PID = 2;
const IDEN = 3;

const CONTINUOUS = 0;
const DISCRETE = 1;


//
window.sb_state = INITIATE; 
window.sb_condis = CONTINUOUS;


window.step = {
    amp: 0,
    it: 0,
    offset: 0,
    dutycycle: 0,
    sign: 0
};


// Create a promise and expose it on the window object
window.jsReadyPromise = new Promise((resolve) => {
    // Store the resolve function so you can call it later
    window.resolveJsReady = resolve;
});


//Ra = 1.19; La = 0.013; Kb = 0.78; Kt = 0.6; Jm = 0.8; Bm = 0.1;

//this is no longer in use
// window.simulate_motor = {
//     armature_resistance: 1.19,
//     armature_inductance: 0.013,
//     back_electromotive_force_constant: 0.78,
//     torque_constant: 0.6,
//     motor_rotor_inertia: 0.8,
//     viscous_friction_coefficient: 0.1 
// };



let SliderDutyCycleHtml = `
    <div class="sidebar_basic_elements">
        <form action="/communicationScript.py">
            <label class="descriptor" for="DutyCyle">Duty Cycle: </label>
            <div>
                
                <input type="number" step="0.01" name="DutyCyle" id="UI_dutycycle" value="100" size="4">
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
    input.size = size; // 7 i think its always gonna be 7
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
    input.size = "8"; // 7 i think its always gonna be 7
    div.appendChild(input);



    div.insertAdjacentHTML("beforeend", dictionaryUnitsOfMeasure["gains_ki"]);

    const input2 = document.createElement("input");
    input2.type = type; //number
    input2.step = step; //0.01  //i genuinly hope this doesnt cause any mistakes
    input2.name = for_d + "ki"; //Amp 
    input2.id = "UI_" + for_d + "k1"; //UI_amp
    input2.size = "8"; // 7 i think its always gonna be 7
    div.appendChild(input2);




    div.insertAdjacentHTML("beforeend", dictionaryUnitsOfMeasure["gains_kd"]);

    const input3 = document.createElement("input");
    input3.type = type; //number
    input3.step = step; //0.01  //i genuinly hope this doesnt cause any mistakes
    input3.name = for_d + "kd"; //Amp 
    input3.id = "UI_" + for_d + "kd"; //UI_amp
    input3.size = "8"; // 7 i think its always gonna be 7
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

//delete all from side bar
function clean_sidebar(place){
    if(window.sb_state == STEP){
        save_step_data()
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
function creating_sidebar_group(father, height_size){
    let creating_sbg = document.createElement('div');
    creating_sbg.classList.add('sidebar_group');
    //let size_class= 'sbgh' + height_size;
    //creating_sbg.classList.add(size_class);
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
    } else if (window.sb_state == IDEN) {
        b_previous_button = document.getElementById("b_identification");
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
    } else if (current_button == IDEN) {
        current_button_name = "b_identification";
    }


    
    b_previous_button.classList.add("sb_button");
    b_previous_button.classList.remove("sb_button_selected");

    const new_button = document.getElementById(current_button_name);
    new_button.classList.remove("sb_button");
    new_button.classList.add("sb_button_selected");

    return current_button;
}










//change to sine
document.getElementById("b_sine").addEventListener("click", () => {
    change_to_sine(CONTINUOUS);
});

function change_to_sine(condis) {

    //check if we are not there currently
    if (window.sb_state == SINE) {
        if (window.sb_condis == condis) {
            return 0;
        }
    }
    window.sb_condis = condis; //because they differ after this

   //info we need:
    const place = document.getElementById("sb_main");


    //delete all from side bar
    clean_sidebar(place);

    //creating sidebar
    const sbc = creating_sidebar_contents(place);

    //create sidebar group with heights:
    const sbg = creating_sidebar_group(sbc, 1);

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
        "Amp",
        "Amplitude:",
        dictionaryUnitsOfMeasure["amp"],
        "number",
        0.01
    );
    sbg2.appendChild(bf);

    const freq = sbf_basicform(
        "/communicationScript.py",
        "Freq",
        "Frequency:",
        dictionaryUnitsOfMeasure["omega"],
        "number",
        0.01
    );
    sbg2.appendChild(freq);

    const phase_angle = sbf_basicform(
        "/communicationScript.py",
        "phase_angle",
        "Phase Angle:",
        dictionaryUnitsOfMeasure["phi"],
        "number",
        0.01
    );
    sbg2.appendChild(phase_angle);

    const offset = sbf_basicform(
        "/communicationScript.py",
        "offset",
        "Offset:",
        dictionaryUnitsOfMeasure["delta"],
        "number",
        0.01
    );
    sbg2.appendChild(offset);


    if (condis == DISCRETE) {
        const offset = sbf_basicform(
            "/communicationScript.py",
            "period",
            "Period:",
            dictionaryUnitsOfMeasure["period"],
            "number",
            0.01
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

    //create sidebar group with heights:
    const sbg = creating_sidebar_group(sbc, 4);


    const sbf = document.createElement('div');
    sbf.classList.add('sidebar_basic_elements');
    sbf.classList.add('formula');
    sbf.style.fontSize = '22px';
    sbg.appendChild(sbf);

    sbf.innerHTML = dictionaryFormulas["step"];

    //create continuous or discrete



    //function sbf_basicform(action, for_d, label_text, Unitofmeasure, type, step)
    const bf = sbf_basicform(
        "/communicationScript.py",
        "amp",
        "Amplitude:",
        dictionaryUnitsOfMeasure["amp"],
        "number",
        0.01,
        window.step["amp"]
    );
    sbg.appendChild(bf);

    const freq = sbf_basicform(
        "/communicationScript.py",
        "it",
        "Initial Time:",
        dictionaryUnitsOfMeasure["timezero"],
        "number",
        0.01,
        window.step["it"]
    );
    sbg.appendChild(freq);

    const offset = sbf_basicform(
        "/communicationScript.py",
        "offset",
        "Offset:",
        dictionaryUnitsOfMeasure["delta"],
        "number",
        0.01,
        window.step["offset"]
    );
    sbg.appendChild(offset);



    const sbg2 = document.createElement('div');
    sbg2.classList.add('sidebar_group');
    sbg2.classList.add('sbgh3');
    sbc.appendChild(sbg2);

    sbg2.innerHTML = SliderDutyCycleHtml;

    const sign = sbf_basicform(
        "/communicationScript.py",
        "sign",
        "Sign V(t):",
        dictionaryUnitsOfMeasure["none"],
        "number",
        0.01
    );
    sbg2.appendChild(sign);

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

    window.sb_state = change_button_highlights(STEP);


    return 0;
}















document.getElementById("b_pid").addEventListener("click", () => {
    change_to_PID(CONTINUOUS);
});

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

    //create sidebar group with heights:
    const sbg = creating_sidebar_group(sbc, 1);

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




//change to identification
document.getElementById("b_identification").addEventListener("click", () => {
    change_to_identification();
});

function change_to_identification() {

    //check if we are not there currently
    if (window.sb_state == IDEN) {
        return 0;
    }

    //info we need:
    const place = document.getElementById("sb_main");


    //delete all from side bar
    clean_sidebar(place);

    //creating sidebar
    const sbc = creating_sidebar_contents(place);

    //create sidebar group with heights:
    const sbg = creating_sidebar_group(sbc, 3);
    
    //create a chooice between step sine and pid
    sbg.innerHTML = `
        <form>
            <p>Select method of identification:</p>
            <input type="radio" id="step" name="method_identification" value="Step" checked>
            <label for="Step">Step</label><br>
            <input type="radio" id="sine" name="method_identification" value="Sine">
            <label for="Sine">Sine</label><br>
            <input type="radio" id="pid" name="method_identification" value="PID">
            <label for="PID">PID</label>
        </form>
    `;
    
    const sbg2 = creating_sidebar_group(sbc, 4);
    // sbg2.innerHTML = `
    //     <button id="UI_submit_identification">Submit</button>
    // `;
    const btn = document.createElement("button");
    btn.className = "UI_submit_identification";
    btn.innerText = "Submit";
    btn.addEventListener("click", () => window.handleIdentification());
    sbg2.appendChild(btn);
    
    
    
    const sbg3 = creating_sidebar_group(sbc, 4);
    //output box really. a p element



    //highlight the bar and unhighlight previous button
    window.sb_state = change_button_highlights(IDEN);
    return 0;
}









change_to_step();


//play and stop expand
const button = document.getElementById("b_collapsible_arrow");
const play_and_stop = document.getElementById("play_and_stop_container");

button.addEventListener("click", () => {
    play_and_stop.classList.toggle("expand");
});




// at the end lets add the dom for the python scrpt
//so we fullfill python promise:

window.resolveJsReady();



