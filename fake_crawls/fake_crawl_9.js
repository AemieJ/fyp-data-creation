import puppeteer from "puppeteer";
import fs from "fs";
import csvWriter from "csv-write-stream";

// the skunk website

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
    let filePath = "../fake/fake_theskunk_content.csv";
    let log = csvWriter({ sendHeaders: false });
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Len", "Content"] });

    log.pipe(fs.createWriteStream(filePath, { flags: 'a' }));

    log.write({
        "Title": titles,
        "Len": texts.length,
        "Content": texts
    });

    log.end();
}

function addToCSVNoTexts(titles, dates, links) {
    let filePath = "../fake/fake_theskunk_title.csv";
    let log = csvWriter({ sendHeaders: false });
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Publishing Date", "Source"] });

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
    document.querySelectorAll(".entry-content > p").forEach((el) => {
        text = el.innerText;
        if (text.length != 0) {
            lst_.push(text)
        }
    });
    let content = lst_.join(" ");

    return content;
}

async function textExtract(URL) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(URL, { waitUntil: 'load', timeout: 4 * 60 * 1000 });
    let textData = await page.evaluate(grabText);
    await browser.close();

    return textData;

}

function detailsExtract() {
    let titles = [];
    let dates = [];
    let links = [];

    document.querySelectorAll("h3.article-title a").forEach((el) => {
        titles.push(el.innerText);
        links.push(el.href);
    });

    document.querySelectorAll("span.posts-date").forEach((el) => {
        dates.push(el.innerText);
    });

    return { titles, links, dates };

}

async function paginationAndScrape() {
    console.log("Pagination scrape");
    let size = 10;

    for (let page_ = 1; page_ < 2; ++page_) {
        console.log(`Scraping through page: ${page_ + 1}`);
        let from_ = page_ * size;
        let URL = `https://theskunk.org/page/${page_+1}/?s=healthcare`;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.goto(URL, { waitUntil: 'load', timeout: 0 });
        console.log(`Page ${page_ + 1} has been loaded`);

        let data = await page.evaluate(detailsExtract);
        addToCSVNoTexts(data.titles, data.dates, data.links);

        let rows = data.links.length;
        for (let row = 0; row < rows; ++row) {
            console.log(`Find the textual content for link ${row + 1}`);
            let link = data.links[row];
            let text = await textExtract(link);

            if (text.length != 0)
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
    const URL = 'https://theskunk.org/?s=healthcare';
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(URL, { waitUntil: 'load', timeout: 0 });
    // first page already scraped

    let data = await page.evaluate(detailsExtract);
    addToCSVNoTexts(data.titles, data.dates, data.links);

    let rows = data.links.length;
    for (let row = 0; row < rows; ++row) {
        console.log(`Find the textual content for link ${row + 1}`);
        let link = data.links[row];
        let text = await textExtract(link);

        if (text.length != 0)
            addToCSV(data.titles[row], text);
    }

    titles = titles.concat(data.titles);
    links = links.concat(data.links);
    dates = dates.concat(data.dates);
    displayDetails(titles, dates, links);

    await page.exposeFunction("paginationAndScrape", paginationAndScrape);
    await page.evaluate(async () => {
        await paginationAndScrape();
        return true;
    });

    await browser.close();
    return { titles, links, dates };
}

extractPostDetails().then((details) => { });
