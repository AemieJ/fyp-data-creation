import puppeteer from "puppeteer";
import fs from "fs";
import csvWriter from "csv-write-stream";

// reductress website

let titles = [];
let links = [];

function displayDetails(titles, links) {
    console.log(`Number of titles: ${titles.length}`);
    console.log(`Number of links: ${links.length}`);
    console.log("\n");
}

function addToCSV(titles, texts, dates) {
    let filePath = "../fake/fake_reductress_content.csv";
    let log = csvWriter({ sendHeaders: false });
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Len", "Content", "Publishing Date"] });

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
    let filePath = "../fake/fake_reductress_title.csv";
    let log = csvWriter({ sendHeaders: false });
    if (!fs.existsSync(filePath))
        log = csvWriter({ headers: ["Title", "Source"] });

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
    document.querySelectorAll("div.entry > p").forEach((el) => {
        text = el.innerText;
        if (text.length != 0) {
            lst_.push(text)
        }
    });
    let content = lst_.join(" ");
    let date = document.querySelector("span.date").innerText;

    return { content, date };
}

async function textExtract(URL) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(URL, { waitUntil: 'load', timeout: 0 });
    console.log("Text page has been loaded!\n");
    let textData = await page.evaluate(grabText);
    await browser.close();

    return textData;

}

function detailsExtract() {
    let titles = [];
    let links = [];

    document.querySelectorAll("article a:first-child").forEach((el) => {
        titles.push(el.getAttribute("title"));
        links.push(el.href);
    });

    return { titles, links };

}

async function paginationAndScrape() {
    console.log("Pagination scrape");
    let size = 10;

    for (let page_ = 1; page_ < 4; ++page_) {
        console.log(`Scraping through page: ${page_ + 1}`);
        let from_ = page_ * size;
        let URL = `https://reductress.com/page/${page_ + 1}/?s=healthcare`;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.goto(URL, { waitUntil: 'load', timeout: 0 });
        console.log(`Page ${page_ + 1} has been loaded`);

        let data = await page.evaluate(detailsExtract);
        addToCSVNoTexts(data.titles, data.links);

        let rows = data.links.length;
        for (let row = 0; row < rows; ++row) {
            console.log(`Find the textual content for link ${row + 1}`);
            let link = data.links[row];
            let textData = await textExtract(link);
            let text = textData.content;
            let date = textData.date;

            if (text.length != 0)
                addToCSV(data.titles[row], text, date);
        }

        titles = titles.concat(data.titles);
        links = links.concat(data.links);
        displayDetails(titles, links);

        await browser.close();
    }
}

async function extractPostDetails() {
    const URL = 'https://reductress.com/page/1/?s=healthcare';
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(URL, { waitUntil: 'load', timeout: 0 });
    // first page already scraped

    // let data = await page.evaluate(detailsExtract);
    // addToCSVNoTexts(data.titles, data.links);

    // let rows = data.links.length;
    // for (let row = 0; row < rows; ++row) {
    //     console.log(`Find the textual content for link ${row + 1}`);
    //     let link = data.links[row];
    //     let textData = await textExtract(link);
    //     let text = textData.content;
    //     let date = textData.date;

    //     if (text.length != 0)
    //         addToCSV(data.titles[row], text, date);
    // }

    // titles = titles.concat(data.titles);
    // links = links.concat(data.links);
    // displayDetails(titles, links);

    await page.exposeFunction("paginationAndScrape", paginationAndScrape);
    await page.evaluate(async () => {
        await paginationAndScrape();
        return true;
    });

    await browser.close();
    return { titles, links };
}

extractPostDetails().then((details) => { });
