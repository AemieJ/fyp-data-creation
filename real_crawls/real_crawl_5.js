import puppeteer from "puppeteer";
import fs from "fs";
import csvWriter from "csv-write-stream";

// toi (times of india) website

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
    let filePath = "../real/real_toi_content.csv";
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
    let filePath = "../real/real_toi_title.csv";
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
    let text = document.querySelector("div.clearfix._3YYSt").innerText;
    return text;
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

    document.querySelectorAll("li.article div.content span.title").forEach((el) => {
        titles.push(el.innerText);
    });

    document.querySelectorAll("li.article div.content a").forEach((el) => {
        links.push(el.href);
    });

    document.querySelectorAll("li.article div.content span.meta").forEach((el) => {
        let date = el.innerText.split(",")[0] + " " + el.innerText.split(",")[1]
        dates.push(date);
    });

    return { titles, dates, links };

}

async function paginationAndScrape(totalPages) {
    console.log("Pagination scrape");
    let size = 18;

    for (let page_ = 12; page_ < 20; ++page_) {
        console.log(`Scraping through page: ${page_ + 1}`);
        let from_ = page_ * size; 
        let URL = `https://timesofindia.indiatimes.com/topic/healthcare/${page_ + 1}`;

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


async function extractPostDetails() {
	try {
		const URL = 'https://timesofindia.indiatimes.com/topic/healthcare';
		const browser = await puppeteer.launch();
		const page = await browser.newPage();

        await page.goto(URL, {waitUntil: 'load', timeout: 0});

        let totalPages = 20;
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
