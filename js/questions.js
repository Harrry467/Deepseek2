// js/questions.js
const QUESTION_BANK = {
    maths: {
        topics: ['algebra', 'calculus', 'geometry', 'trigonometry', 'statistics'],
        KS3: {
            algebra: [
                "Solve for x: 2x + 5 = 15",
                "Expand: 3(x + 4)",
                "Simplify: 4a + 2b - a + 3b",
                "Solve: 3(x - 2) = 12",
                "If y = 2x + 1, find y when x = 3",
                "What is the value of 4x when x = 7?",
                "Solve: 5x - 3 = 2x + 9"
            ],
            calculus: [
                "What is the derivative of x²?",
                "Find the gradient of the line y = 3x + 2",
                "What is the area under the curve y = x between x=0 and x=4?",
                "If the rate of change of y with respect to x is 2, what is dy/dx?"
            ],
            geometry: [
                "What is the area of a circle with radius 4?",
                "Find the perimeter of a rectangle 5cm by 3cm",
                "What is the volume of a cube with side 3cm?",
                "Calculate the area of a triangle with base 6 and height 4"
            ],
            trigonometry: [
                "What is sin(90°)?",
                "If cos(θ) = 0.5, what is θ (0° to 90°)?",
                "What is tan(45°)?"
            ],
            statistics: [
                "Find the mean of 4, 8, 15, 16, 23, 42",
                "What is the median of 2, 5, 7, 9, 11?",
                "What is the mode of 3, 5, 3, 7, 9?"
            ]
        },
        GCSE: {
            algebra: [
                "Factorise x² + 5x + 6",
                "Solve the quadratic x² - 5x + 6 = 0",
                "Expand (x + 3)(x - 2)",
                "Solve 2x² - 8x = 0",
                "Rearrange y = mx + c to make x the subject",
                "Find the roots of x² - 4x - 5 = 0"
            ],
            calculus: [
                "Find dy/dx of y = 3x² - 2x + 1",
                "Integrate ∫(2x) dx",
                "Find the stationary point of y = x² - 4x",
                "Differentiate y = 5x³"
            ],
            geometry: [
                "Calculate the volume of a cylinder radius 3, height 5",
                "Find the length of the hypotenuse in a right triangle with sides 6 and 8",
                "What is the area of a sector with radius 5cm and angle 60°?",
                "Find the surface area of a sphere radius 4"
            ],
            trigonometry: [
                "Solve sinθ = 0.5 for 0<θ<90°",
                "If tanθ = 3/4, find sinθ",
                "Calculate the angle of elevation if opposite is 5 and adjacent is 12"
            ],
            statistics: [
                "Calculate the interquartile range of 2, 5, 7, 9, 11, 14, 16",
                "What is the probability of rolling a 6 on a fair die?",
                "Find the variance of 2, 4, 6, 8, 10"
            ]
        },
        ALevel: {
            algebra: [
                "Solve the quadratic equation 2x² - 5x - 3 = 0",
                "Find the roots of x³ - 2x² - 5x + 6 = 0",
                "Simplify (x² - 4)/(x - 2)",
                "Solve the inequality x² - 3x - 10 > 0",
                "Find the remainder when x³ - 2x² + 5 is divided by (x - 1)"
            ],
            calculus: [
                "Integrate ∫(3x² + 2x) dx",
                "Find the derivative of e^(2x) sin(x)",
                "Find the area between y = x² and y = x from x=0 to x=1",
                "Solve dy/dx = 6x² given y(0)=1",
                "Find the stationary points of y = x³ - 3x"
            ],
            geometry: [
                "Prove that the angle in a semicircle is 90°",
                "Find the equation of the tangent to y = x² at x=2",
                "Calculate the volume of revolution of y = √x about the x-axis from 0 to 4",
                "Find the coordinates of the centroid of a triangle with vertices (0,0), (4,0), (0,4)"
            ],
            trigonometry: [
                "Prove the identity sin²θ + cos²θ = 1",
                "Solve 2cos²x - 1 = 0 for 0≤x≤2π",
                "Find all solutions to sin(2x) = 1/2",
                "Express 3 sin x + 4 cos x in the form R sin(x + α)"
            ],
            statistics: [
                "Given a binomial distribution X~B(10,0.3), find P(X=3)",
                "Calculate the standard deviation of the dataset: 4, 8, 15, 16, 23, 42",
                "Find the correlation coefficient for points (1,2), (2,4), (3,5)"
            ]
        }
    },
    physics: {
        topics: ['mechanics', 'electricity', 'waves', 'thermodynamics'],
        KS3: {
            mechanics: ["What is speed?", "Define force."],
            electricity: ["What is a conductor?", "Name two insulators."],
            waves: ["What is frequency?", "What is amplitude?"],
            thermodynamics: ["What is temperature?", "What is conduction?"]
        },
        GCSE: {
            mechanics: ["Calculate kinetic energy of a 2kg mass at 3m/s", "State Newton's second law."],
            electricity: ["Ohm's law: V = ?", "Calculate resistance if V=12V, I=2A"],
            waves: ["What is the wave equation?", "What is the Doppler effect?"],
            thermodynamics: ["What is specific heat capacity?", "How is heat transferred by convection?"]
        },
        ALevel: {
            mechanics: ["Derive the SUVAT equations", "Explain conservation of momentum"],
            electricity: ["Kirchhoff's first law", "Calculate equivalent resistance of parallel 2Ω and 3Ω"],
            waves: ["Explain diffraction grating", "Calculate the speed of sound using resonance"],
            thermodynamics: ["State the laws of thermodynamics", "Calculate efficiency of a Carnot engine"]
        }
    },
    chemistry: {
        topics: ['bonding', 'reactions', 'periodic-table', 'organic'],
        KS3: {
            bonding: ["What is an atom?"],
            reactions: ["What is a chemical reaction?"],
            'periodic-table': ["Name two noble gases"],
            organic: ["What is a hydrocarbon?"]
        },
        GCSE: {
            bonding: ["Describe ionic bonding"],
            reactions: ["What is a catalyst?"],
            'periodic-table': ["What are halogens?"],
            organic: ["What is the functional group of alkenes?"]
        },
        ALevel: {
            bonding: ["Explain molecular orbital theory"],
            reactions: ["What is activation energy?"],
            'periodic-table': ["Discuss periodic trends in electronegativity"],
            organic: ["What is the functional group of alcohols?"]
        }
    },
    biology: {
        topics: ['cells', 'genetics', 'ecology', 'physiology'],
        KS3: {
            cells: ["What is the function of the nucleus?"],
            genetics: ["What is DNA?"],
            ecology: ["Define habitat"],
            physiology: ["What is the purpose of the heart?"]
        },
        GCSE: {
            cells: ["Differences between plant and animal cells"],
            genetics: ["What is a gene?"],
            ecology: ["What is a food web?"],
            physiology: ["How does the digestive system work?"]
        },
        ALevel: {
            cells: ["Describe the structure of mitochondria"],
            genetics: ["Explain transcription"],
            ecology: ["Discuss the nitrogen cycle"],
            physiology: ["How does the heart pump blood?"]
        }
    },
    english: {
        topics: ['literature', 'writing', 'language', 'poetry'],
        KS3: {
            literature: ["What is a metaphor?"],
            writing: ["Write a persuasive sentence about school"],
            language: ["What is alliteration?"],
            poetry: ["What is a rhyme scheme?"]
        },
        GCSE: {
            literature: ["Analyze the character of Macbeth"],
            writing: ["How to structure a persuasive essay"],
            language: ["Identify the effects of personification"],
            poetry: ["Compare 'Ozymandias' and 'The Prelude'"]
        },
        ALevel: {
            literature: ["Discuss the themes in 'The Handmaid's Tale'"],
            writing: ["Analyze the use of narrative voice"],
            language: ["Explain the concept of sociolect"],
            poetry: ["Analyze the use of imagery in 'The Waste Land'"]
        }
    }
};

function getRandomQuestion(subject, topic, level) {
    const subjectData = QUESTION_BANK[subject];
    if (!subjectData) return "Question bank not available for this subject.";
    const topicQuestions = subjectData[level]?.[topic];
    if (!topicQuestions || topicQuestions.length === 0) {
        const firstTopic = Object.keys(subjectData[level])[0];
        return subjectData[level][firstTopic]?.[0] || "No questions available.";
    }
    const randomIndex = Math.floor(Math.random() * topicQuestions.length);
    return topicQuestions[randomIndex];
}

function updateTopics() {
    const subject = document.getElementById('subject').value;
    const topics = QUESTION_BANK[subject]?.topics || [];
    const topicSelect = document.getElementById('topic');
    topicSelect.innerHTML = '';
    topics.forEach(t => {
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        topicSelect.appendChild(option);
    });
    if (topics.length === 0) {
        const option = document.createElement('option');
        option.value = 'general';
        option.textContent = 'General';
        topicSelect.appendChild(option);
    }
    // after updating topics, regenerate question if needed
    if (typeof generateQuestion === 'function') generateQuestion();
}

// Make functions globally available
window.getRandomQuestion = getRandomQuestion;
window.updateTopics = updateTopics;
window.QUESTION_BANK = QUESTION_BANK;
