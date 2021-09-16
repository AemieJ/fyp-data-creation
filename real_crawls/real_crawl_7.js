import puppeteer from "puppeteer";
import fs from "fs";
import csvWriter from "csv-write-stream";

// the time magazine

let titles = [];
let links = [];

function displayDetails(titles, links) {
    console.log(`Number of titles: ${titles.length}`);
    console.log(`Number of links: ${links.length}`);
    console.log("\n");
}

function addToCSV(titles, texts, dates) {
    let filePath = "../real/real_time_content.csv";
    let log = csvWriter({sendHeaders: false});
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Len", "Content", "Publishing Date"]});

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    log.write({
        "Title": titles,
        "Len": texts.length,
        "Content": texts,
        "Publishing Date": dates
    });

    log.end();
}

function addToCSVNoTexts(titles, links) {
    let filePath = "../real/real_time_title.csv";
    let log = csvWriter({sendHeaders: false});
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Source"]});

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    let length = titles.length;

    for (let row = 0; row < length; ++row) {
        log.write({
            "Title": titles[row],
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
    document.querySelectorAll(".content div > p").forEach((el) => {
        if (! el.classList.contains("author-feedback-text")) {
            text = el.innerText; 
            if (text.length != 0) { 
                lst_.push(text)
            }
        }
    });

    let content = lst_.join(" ");
    let date_list = document.querySelector(".timestamp.published-date").innerText.split(" ")
    let date = date_list[0] + " " + date_list[1] + " " + date_list[2]
    return { content, date };
}

async function textExtract(URL) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
        
    try {
        await page.goto(URL, {waitUntil: 'load', timeout: 0});
        let textData = await page.evaluate(grabText);

        await browser.close();
        return textData;
    } catch(e) { 
        let content = "";
        let date = "";
        return { content, date };
    }


}

function detailsExtract() {
    let titles = [];
    let links = [];

    document.querySelectorAll("div.headline a").forEach((el) => {
        titles.push(el.innerText);
        links.push(el.href);
    });

    return { titles, links };

}

async function paginationAndScrape(totalPages) {
    console.log("Pagination scrape");
    let size = 9;

    for (let page_ = 10; page_ < 11; ++page_) {
        console.log(`Scraping through page: ${page_ + 1}`);
        let from_ = page_ * size; 
        let URL = `https://time.com/search/?q=healthcare&page=${page_ + 1}`;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        await page.goto(URL, {waitUntil: 'load', timeout: 0});
        console.log(`Page ${page_ + 1} has been loaded`);

        let data = await page.evaluate(detailsExtract);
        addToCSVNoTexts(data.titles, data.links);

        let rows = data.links.length;
        for (let row = 0; row < rows; ++row) {
            console.log(`Find the textual content for link ${row+1}`);
            let link = data.links[row];
            let textData = await textExtract(link);
            let text = textData.content;
            let date = textData.date;
            if (text.length !== 0)
                addToCSV(data.titles[row], text, date);
        }

        titles = titles.concat(data.titles);
        links = links.concat(data.links);
        displayDetails(titles, links);

        await browser.close();
    }
}


async function extractPostDetails() {
	try {
		const URL = 'https://time.com/search/?q=healthcare';
		const browser = await puppeteer.launch();
		const page = await browser.newPage();

        await page.goto(URL, {waitUntil: 'load', timeout: 0});

        let totalPages = 11;
        console.log(`Total pages: ${totalPages}`);
        // first page already scraped

        let data = await page.evaluate(detailsExtract);
        addToCSVNoTexts(data.titles, data.links);

        // let rows = data.links.length;
        // for (let row = 0; row < rows; ++row) {
        //     console.log(`Find the textual content for link ${row+1}`);
        //     let link = data.links[row];
        //     let textData = await textExtract(link);
        //     let text = textData.content;
        //     let date = textData.date;
        //     if (text.length !== 0)
        //         addToCSV(data.titles[row], text, date);
        // }

        // titles = titles.concat(data.titles);
        // links = links.concat(data.links);
        // displayDetails(titles, links);

        await page.exposeFunction("paginationAndScrape", paginationAndScrape);
        await page.evaluate(async (totalPages) => {
            await paginationAndScrape(totalPages);
            return true;
        }, totalPages);


        await browser.close();
        return { titles, links };
	} catch (error) {
		console.error(error);
	}
}

extractPostDetails().then((details) => {});
