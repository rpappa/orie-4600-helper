// nothing in here is great code, but it works

math.config({
    number: 'Fraction'
});

const CALL_EXAMPLE = `return math.max(math.subtract(s[n], K), 0)`;
const PUT_EAMPLE = `return math.max(math.subtract(K, s[n]), 0)`;
const STRADDLE_EXAMPLE = `return math.add(math.max(math.subtract(s[n], K), 0),
    math.max(math.subtract(K, s[n]), 0));`
const PAYMENTS_EXAMPLE = `switch(flips) {
    case 'HHH':
        return 19;
    case 'HHT':
    case 'HTH':
        return 5;
    case 'HH':
        return 11;
    case 'H':
        return 5;
}
return 0;`

const PAYMENTS_EXERCISE = `return n === N ? gn : math.add(vn, gn);`

const EXERCISE_EXAMPLE = 
`if(isAmerican) {
    return math.max(vn, gn)
} else {
    return vn;
}`

/**
 * The usual V_n = 1 / (1+r) (p V_{n+1}(H) + q V_{n+1}(T))
 * @param {math.fraction} phat risk-neutral "heads" probability
 * @param {math.fraction} qhat risk-neutral "tails" probability
 * @param {math.fraction} r risk-free rate
 * @param {math.fraction} heads V_{n+1}(H)
 * @param {math.fraction} tails V_{n+1}(T)
 */
function value(phat, qhat, r, heads, tails) {
    return math.multiply(
        math.divide(1, math.add(1, r)),
        math.add(
            math.multiply(phat, heads),
            math.multiply(qhat, tails)
        )
    );
}

/**
 * Helper
 * Return stock prices for each coin flip
 * @param {string} flips coin flips, for example "HHT"
 * @param {{[flips: string]: string}[]} stockPrices entire stock price tree
 */
function getStockPricePath(flips, stockPrices) {
    const prices = [];
    for(let i = 0; i <= flips.length; i++) {
        prices.push(stockPrices[i][flips.substring(0, i)]);
    }
    return prices.map(p => math.fraction(p));
}

const app = new Vue({
    el: '#app',
    data: {
        up: '2',
        down: '1/2',
        riskfree: '1/4',
        s0: '100',
        periods: 2,
        K: 50,
        isAmerican: false,
        code: CALL_EXAMPLE,
        exerciseCode: EXERCISE_EXAMPLE,
        showHelp: false
    },
    computed: {
        /**
         * Get stock price tree
         */
        stockPrices: function () {
            const periods = new Array(parseInt(`${this.periods}`) + 1).fill(undefined);
            for (let i = 0; i < periods.length; i++) {
                if (i === 0) {
                    periods[i] = {
                        '': this.s0
                    }
                } else {
                    console.log(Object.entries(periods[i - 1]));
                    const up = math.fraction(this.up);
                    const down = math.fraction(this.down);
                    const nextSequence = Object.entries(periods[i - 1])
                        .map(([seq, val]) => [[seq + 'H', math.multiply(math.fraction(val), up).toFraction()],
                        [seq + 'T', math.multiply(math.fraction(val), down).toFraction()]]).flat();
                    periods[i] = Object.fromEntries(nextSequence);
                }
            }
            return periods;
        },
        /*
        * Get stock price latex
        */
        pricesLatex: function () {
            return `\\begin{tabular}{c|c}
            \\hline
            ${this.stockPrices.map((p, i) => {
                if (i === 0) {
                    return `$S_0$ & $${p['']}$`
                } else {
                    console.log(Object.entries(p))
                    return Object.entries(p).map(([seq, val]) => `$S_${i}(${seq})$ & $${val}$`).join('\\\\\n')
                }
            }).join('\\\\\n\\hline\n')}
            \\\\\n\\hline
            \\end{tabular}`.split('\n').map(l => l.trim()).join('\n')
        },
        /*
        * Get stock price for HTML table
        */
        pricesForTable: function() {
            try {
                return this.stockPrices.map((p, i) => {
                    if(i === 0) {
                        return [[`S<sub>0</sub>`, p['']]]
                    }
                    return Object.entries(p).map(([seq, val]) => ([`S<sub>${i}</sub>(${seq})`, `${val}`]))
                }).flat();
            } catch (e) {

            }
        },
        /*
        * Risk-neutrals (really should be pTildeQTilde but thats ugly)
        */
        pHatQHat: function () {
            return [
                math.divide(
                    math.subtract(math.add(1, math.fraction(this.riskfree)), math.fraction(this.down)),
                    math.subtract(math.fraction(this.up), math.fraction(this.down))
                ).toFraction(),
                math.divide(
                    math.subtract(math.fraction(this.up), math.add(1, math.fraction(this.riskfree))),
                    math.subtract(math.fraction(this.up), math.fraction(this.down))
                ).toFraction()
            ]
        },
        /*
        * Option value tree
        */
        optionValues: function() {
            try {
                const iv = new Function('K', 's', 'n', 'N', 'flips', this.code);
                const exercise = new Function('K', 's', 'n', 'N', 'flips', 'vn', 'gn', 'isAmerican', this.exerciseCode);
    
                const N = parseInt(`${this.periods}`);
                const K = math.fraction(`${this.K}`);
    
                const values = _.cloneDeep(this.stockPrices);
    
                const phat = math.fraction(this.pHatQHat[0]);
                const qhat = math.fraction(this.pHatQHat[1]);
                const r = math.fraction(this.riskfree);
    
                for(let n = values.length - 1; n >= 0; n--) {
                    const entries = Object.entries(values[n]);
                    for(let [flips, stockPrice] of entries) {
                        // This will return an array like [50, 100, 75] if flips = HT, u = 2, d = 3/4
                        const pricePath = getStockPricePath(flips, this.stockPrices);

                        // get IV from user-supplied function
                        const gn = math.fraction(iv(K, pricePath, n, N, flips));

                        // vn = value at n
                        // gn = IV at n
                        // if n === N, then vn === gn. Else temporarily assign it to the value found with
                        // risk-neutral probabilities
                        const vn = n === N ? gn : value(phat, qhat, r,
                            math.fraction(values[n + 1][flips + 'H']),
                            math.fraction(values[n + 1][flips + 'T']));

                        // the function is named "excercise" because it was originally intended to
                        // be used to implement early exercise rules for American options, but
                        // it can also be used for things like options with payments
                        const e = exercise(K, pricePath, n, N, flips, vn, gn, this.isAmerican);
                        values[n][flips] = e.toFraction();
                    }
                }
                return values;
            } catch (e) {
                console.error(e);
            }
        },
        /*
        * Option values as latex
        */
        valuesLatex: function () {
            try {
                return `\\begin{tabular}{c|c}
                \\hline
                ${this.optionValues.map((p, i) => {
                    if (i === 0) {
                        return `$V_0$ & $${p['']}$`
                    } else {
                        console.log(Object.entries(p))
                        return Object.entries(p).map(([seq, val]) => `$V_${i}(${seq})$ & $${val}$`).join('\\\\\n')
                    }
                }).join('\\\\\n\\hline\n')}
                \\\\\n\\hline
                \\end{tabular}`.split('\n').map(l => l.trim()).join('\n')
            } catch (e) {
                return ''
            }
        },
        /*
        * Options values for HTML table
        */
        valuesForTable: function() {
            try {
                return this.optionValues.map((p, i) => {
                    if(i === 0) {
                        return [[`V<sub>0</sub>`, p['']]]
                    }
                    return Object.entries(p).map(([seq, val]) => ([`V<sub>${i}</sub>(${seq})`, `${val}`]))
                }).flat();
            } catch (e) {

            }
        }
    },
    methods: {
        highlighter(code) {
            // js highlight example
            return Prism.highlight(code, Prism.languages.js, "js");
        },
        fillCode(type) {
            switch(type) {
                case 'call':
                    this.code = CALL_EXAMPLE;
                    break;
                case 'put':
                    this.code = PUT_EAMPLE;
                    break;
                case 'straddle':
                    this.code = STRADDLE_EXAMPLE;
                    break;
                case 'payments':
                    this.code = PAYMENTS_EXAMPLE;
                    this.exerciseCode = PAYMENTS_EXERCISE;
                    break;
                case 'reset':
                    this.exerciseCode = EXERCISE_EXAMPLE;
                    break;
            }
        },
        displayHelp() {
            this.showHelp = true;
        }
    }
})