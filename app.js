async function loadData(){

const countries = await fetch("data/countries.json").then(r=>r.json())
const animals = await fetch("data/animals.json").then(r=>r.json())
const unesco = await fetch("data/unesco.json").then(r=>r.json())
const peaks = await fetch("data/county_peaks.json").then(r=>r.json())

document.getElementById("countryCount").textContent = countries.length
document.getElementById("animalCount").textContent = animals.length
document.getElementById("unescoCount").textContent = unesco.length
document.getElementById("peakCount").textContent = peaks.length

}

loadData()
