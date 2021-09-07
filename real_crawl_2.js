import puppeteer from "puppeteer";
import fs from "fs";
import csvWriter from "csv-write-stream";

// reuters website

let titles = [];
let dates = [];
let links = [];

function displayDetails(titles, dates, links) {
    console.log(`Number of titles: ${titles.length}`);
    console.log(`Number of dates: ${dates.length}`);
    console.log(`Number of links: ${links.length}`);
    console.log("\n");
}

function addToCSV(titles, texts) {
    let filePath = "./real/real_reuters_content.csv";
    let log = csvWriter({sendHeaders: false});
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Len", "Content"]});

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    log.write({
        "Title": titles,
        "Len": texts.length,
        "Content": texts
    });

    log.end();
}

function addToCSVNoTexts(titles, dates, links) {
    let filePath = "./real/real_reuters_title.csv";
    let log = csvWriter({sendHeaders: false});
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Publishing Date", "Source"]});

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    let length = titles.length;

    for (let row = 0; row < length; ++row) {
        log.write({
            "Title": titles[row],
            "Publishing Date": dates[row],
            "Source": links[row]
        });
    }

    log.end();
}

// extract titles
// extract link to title
// extract data of title
// extract text of document/news

function grabText() {
    let lst_ = [];
    document.querySelectorAll(".paywall-article p").forEach((el) => {
        text = el.innerText; 
        if (text.length != 0) { 
            lst_.push(text)
        }
    });
    return lst_.join(" ");
}

async function textExtract(URL) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
        
    try {
        await page.goto(URL, {waitUntil: 'load', timeout: 0});
        let text = await page.evaluate(grabText);

        await browser.close();
        return text;
    } catch(e) { return "" }


}

function detailsExtract() {
    let titles = [];
    let dates = [];
    let links = [];

    document.querySelectorAll(".SearchResults__sectionContainer___Gd1afW li a").forEach((el) => {
        titles.push(el.querySelector("h6").innerText);
        links.push(el.href);
        dates.push(el.querySelector("time").innerText.split("·")[0]);
    });

    return { titles, dates, links };

}

async function paginationAndScrape(totalPages) {
    console.log("Pagination scrape");
    let size = 10;

    for (let page_ = 12; page_ < 200; ++page_) {
        console.log(`Scraping through page: ${page_ + 1}`);
        let from_ = page_ * size; 
        let URL = `https://www.reuters.com/site-search/?query=health&sort=newest&offset=${from_}`;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        await page.goto(URL, {waitUntil: 'load', timeout: 0});
        console.log(`Page ${page_ + 1} has been loaded`);

        let data = await page.evaluate(detailsExtract);
        addToCSVNoTexts(data.titles, data.dates, data.links);

        let rows = data.links.length;
        for (let row = 0; row < rows; ++row) {
            console.log(`Find the textual content for link ${row+1}`);
            let link = data.links[row];
            let text = await textExtract(link);
            
            addToCSV(data.titles[row], text);
        }

        titles = titles.concat(data.titles);
        links = links.concat(data.links);
        dates = dates.concat(data.dates);
        displayDetails(titles, dates, links);

        await browser.close();
    }
}

// get maximum pages 
function totalTitle() {
    let length = document.querySelector(".SearchResults__subtitle___zxFMs2 span.count").innerText.split(" ")[0];
    return parseInt(length);
}

async function extractPostDetails() {
	try {
		const URL = 'https://www.reuters.com/site-search/?query=health&sort=newest&offset=0';
		const browser = await puppeteer.launch();
		const page = await browser.newPage();

        await page.goto(URL, {waitUntil: 'load', timeout: 0});

        let totalTitles = await  page.evaluate(totalTitle); 
        let totalPages = Math.ceil(totalTitles / 10);
        console.log(`Total pages: ${totalPages}`);
        // first page already scraped

        // let data = await page.evaluate(detailsExtract);
        // addToCSVNoTexts(data.titles, data.dates, data.links);

        // let rows = data.links.length;
        // for (let row = 0; row < rows; ++row) {
        //     console.log(`Find the textual content for link ${row+1}`);
        //     let link = data.links[row];
        //     let text = await textExtract(link);
            
        //     addToCSV(data.titles[row], text);
        // }

        // titles = titles.concat(data.titles);
        // links = links.concat(data.links);
        // dates = dates.concat(data.dates);
        // displayDetails(titles, dates, links);

        await page.exposeFunction("paginationAndScrape", paginationAndScrape);
        await page.evaluate(async (totalPages) => {
            await paginationAndScrape(totalPages);
            return true;
        }, totalPages);


        await browser.close();
        return { titles, links, dates };
	} catch (error) {
		console.error(error);
	}
}

extractPostDetails().then((details) => {});
